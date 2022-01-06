

const k = 0.00003;
const smallestPassingDistanceSquared = 0.0003;


function jsUpdateCharges(
  particleNumber,
  curMArray,
  curQArray,
  curXArray,
  curYArray,
  curVxArray,
  curVyArray,
  integrationSteps,
  dt,
  mediumFriction,
  wallsElasticity,
) {
    // Chrome on a decent CPU takes here ~15ms for 50 particles and 1000 steps of integration.
    // Just enough to get 60fps. Inner loop is O(n^2) so 100 particles need 4 times longer,
    // and over 1 gigaflops of throughput - not easy to meet in plain Javascript.

    // Only need extra buffers for positions and velocities, masses and charges are const.
    const arraySize = particleNumber * Float32Array.BYTES_PER_ELEMENT;
    const buffer = new ArrayBuffer(4 * arraySize);
    let nextXArray = new Float32Array(buffer, 0 * arraySize, particleNumber);
    let nextYArray = new Float32Array(buffer, 1 * arraySize, particleNumber);
    let nextVxArray = new Float32Array(buffer, 2 * arraySize, particleNumber);
    let nextVyArray = new Float32Array(buffer, 3 * arraySize, particleNumber);

    const vScale = k * dt;

    for (let i = 0; i < integrationSteps; i++) {
        for (let j = 0; j < particleNumber; j++) {
            const m = curMArray[j];
            const q = curQArray[j];
            let x = curXArray[j];
            let y = curYArray[j];
            let vx = curVxArray[j];
            let vy = curVyArray[j];

            if (m !== Infinity) {
                /* Manually inlined field strength calculation */
                let strengthX = 0.0;
                let strengthY = 0.0;

                for (let l = 0; l < particleNumber; l++) {
                    const dx = x - curXArray[l];
                    const dy = y - curYArray[l];
                    const dx2 = dx * dx;
                    const dy2 = dy * dy;
                    const r2 = dx2 + dy2;

                    if (r2 >= smallestPassingDistanceSquared) {
                        const tmp = curQArray[l] / r2 / Math.sqrt(r2);
                        strengthX += dx * tmp;
                        strengthY += dy * tmp;
                    }
                }
                /* Manually inlined field strength calculation */

                const tmp2 = vScale * q / m;
                vx += strengthX * tmp2;
                vy += strengthY * tmp2;
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
            }

            nextXArray[j] = x;
            nextYArray[j] = y;
            nextVxArray[j] = vx;
            nextVyArray[j] = vy;
        }

        const tmp1 = curXArray;
        curXArray = nextXArray;
        nextXArray = tmp1;
        const tmp2 = curYArray;
        curYArray = nextYArray;
        nextYArray = tmp2;
        const tmp3 = curVxArray;
        curVxArray = nextVxArray;
        nextVxArray = tmp3;
        const tmp4 = curVyArray;
        curVyArray = nextVyArray;
        nextVyArray = tmp4;
    }

    return [curMArray, curQArray, curXArray, curYArray, curVxArray, curVyArray];
}


let wasmUpdateCharges = undefined;


WebAssembly.instantiateStreaming(fetch('wasm-physics.wasm'), {}).then(obj => {
    const {updateCharges, memory} = obj.instance.exports;

    wasmUpdateCharges = (
      particleNumber,
      curMArray,
      curQArray,
      curXArray,
      curYArray,
      curVxArray,
      curVyArray,
      integrationSteps,
      dt,
      mediumFriction,
      wallsElasticity,
    ) => {
        // 6 x cur arrays + 4 next array
        const buffer = new Float32Array(memory.buffer, 0, 10 * particleNumber);

        let startOffset = 0;
        buffer.set(curMArray, startOffset);
        startOffset += particleNumber;
        buffer.set(curQArray, startOffset);
        startOffset += particleNumber;
        buffer.set(curXArray, startOffset);
        startOffset += particleNumber;
        buffer.set(curYArray, startOffset);
        startOffset += particleNumber;
        buffer.set(curVxArray, startOffset);
        startOffset += particleNumber;
        buffer.set(curVyArray, startOffset);

        updateCharges(particleNumber, buffer.byteOffset, integrationSteps, dt, mediumFriction, wallsElasticity);

        startOffset += particleNumber;
        let endOffset = startOffset + particleNumber;
        curXArray.set(buffer.subarray(startOffset, endOffset));
        startOffset += particleNumber;
        endOffset += particleNumber;
        curYArray.set(buffer.subarray(startOffset, endOffset));
        startOffset += particleNumber;
        endOffset += particleNumber;
        curVxArray.set(buffer.subarray(startOffset, endOffset));
        startOffset += particleNumber;
        endOffset += particleNumber;
        curVyArray.set(buffer.subarray(startOffset, endOffset));

        return [curMArray, curQArray, curXArray, curYArray, curVxArray, curVyArray];
    };
});


onmessage = ({data}) => {
    const {
        mArray, qArray, xArray, yArray, vxArray, vyArray, integrationSteps, dt, mediumFriction, wallsElasticity, useWasm,
    } = data;
    const updateCharges = (useWasm && wasmUpdateCharges) ? wasmUpdateCharges : jsUpdateCharges;

    const timestamp = performance.now();
    if (dt > 0) {
        const [newMArray, newQArray, newXArray, newYArray, newVxArray, newVyArray] = updateCharges(
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
        data.mArray = newMArray;
        data.qArray = newQArray;
        data.xArray = newXArray;
        data.yArray = newYArray;
        data.vxArray = newVxArray;
        data.vyArray = newVyArray;
    }
    data.physicsDuration = performance.now() - timestamp;

    postMessage(data);
};
