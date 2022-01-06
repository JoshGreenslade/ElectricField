

const k = 0.00003;
const smallestPassingDistanceSquared = 0.0003;


function jsUpdateCharges(
  length, mArray, qArray, xArray, yArray, vxArray, vyArray, integrationSteps, dt, mediumFriction, wallsElasticity,
) {
    // Chrome on a decent CPU takes here ~15ms for 50 particles and 1000 steps of simulation.
    // Just enough to get 60fps. Inner loop is O(n^2) so 100 particles need 4 times longer,
    // and over 1 gigaflops of throughput - not easy to meet in plain Javascript.

    const vScale = k * dt;

    for (let i = 0; i < integrationSteps; i++) {
        for (let j = 0; j < length; j++) {
            const m = mArray[j];
            if (m === Infinity) {
                continue;
            }

            let x = xArray[j];
            let y = yArray[j];

            /* Manually inlined field strength calculation */
            let strengthX = 0.0;
            let strengthY = 0.0;

            for (let l = 0; l < length; l++) {
                const dx = x - xArray[l];
                const dy = y - yArray[l];
                const dx2 = dx * dx;
                const dy2 = dy * dy;
                const r2 = dx2 + dy2;

                if (r2 >= smallestPassingDistanceSquared) {
                    const tmp = qArray[l] / r2 / Math.sqrt(r2);
                    strengthX += dx * tmp;
                    strengthY += dy * tmp;
                }
            }
            /* Manually inlined field strength calculation */

            const tmp2 = vScale * qArray[j] / m;
            let vx = vxArray[j] + strengthX * tmp2;
            let vy = vyArray[j] + strengthY * tmp2;
            vx *= mediumFriction;
            vy *= mediumFriction;
            x += vx * dt;
            y += vy * dt;

            // Walls
            if (x >= 1.0) {
                vx *= -wallsElasticity;
                x = 2.0 - x;
            } else if (x <= -1.0) {
                vx *= -wallsElasticity;
                x = -2.0 - x;
            }
            if (y >= 1.0) {
                vy *= -wallsElasticity;
                y = 2.0 - y;
            } else if (y <= -1.0) {
                vy *= -wallsElasticity;
                y = -2.0 - y;
            }

            xArray[j] = x;
            yArray[j] = y;
            vxArray[j] = vx;
            vyArray[j] = vy;
        }
    }
}


let wasmUpdateCharges = undefined;


WebAssembly.instantiateStreaming(fetch('wasm-physics.wasm'), {}).then(obj => {
    const {updateCharges, memory} = obj.instance.exports;

    wasmUpdateCharges = (
      length, mArray, qArray, xArray, yArray, vxArray, vyArray, integrationSteps, dt, mediumFriction, wallsElasticity,
    ) => {
        let offset = 0

        // TODO memory grow when needed? For now 1 page of 64kB should be fine.
        const copy = (src, dst) => {
            if (dst == null) {
                dst = new Float32Array(memory.buffer, offset, length);
                offset += length * Float32Array.BYTES_PER_ELEMENT;
            }
            dst.set(src);
            return dst;
        };

        const mArrayCopy = copy(mArray);
        const qArrayCopy = copy(qArray);
        const xArrayCopy = copy(xArray);
        const yArrayCopy = copy(yArray);
        const vxArrayCopy = copy(vxArray);
        const vyArrayCopy = copy(vyArray);

        updateCharges(
            length,
            mArrayCopy.byteOffset,
            qArrayCopy.byteOffset,
            xArrayCopy.byteOffset,
            yArrayCopy.byteOffset,
            vxArrayCopy.byteOffset,
            vyArrayCopy.byteOffset,
            integrationSteps,
            dt,
            mediumFriction,
            wallsElasticity,
        );

        copy(mArrayCopy, mArray);
        copy(qArrayCopy, qArray);
        copy(xArrayCopy, xArray);
        copy(yArrayCopy, yArray);
        copy(vxArrayCopy, vxArray);
        copy(vyArrayCopy, vyArray);
    };
});


onmessage = ({data}) => {
    const {
        mArray, qArray, xArray, yArray, vxArray, vyArray, integrationSteps, dt, mediumFriction, wallsElasticity, useWasm,
    } = data;
    const updateCharges = (useWasm && wasmUpdateCharges) ? wasmUpdateCharges : jsUpdateCharges;

    const timestamp = performance.now();
    if (dt > 0) {
        updateCharges(
          mArray.length,
          mArray,
          qArray,
          xArray,
          yArray,
          vxArray,
          vyArray,
          integrationSteps,
          dt,
          mediumFriction,
          wallsElasticity,
        );
    }
    data.physicsDuration = performance.now() - timestamp;

    postMessage(data);
};
