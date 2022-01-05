

const k = 0.001;
const smallestPassingDistanceSquared = 0.00003;


function jsRenderScene(width, height, buffer, length, qArray, xArray, yArray) {
    const u8buffer = new Uint8ClampedArray(buffer);
    const dySquaredArray = new Float32Array(length);

    // TODO sanity checks on size.
    const dy = -2.0 / (height - 1);
    const dx = 2.0 / (width - 1);

    let i = 0;
    let y = 1.0;
    for (let ry = 0; ry < height; ry++) {

        for (let j = 0; j < length; j++) {
            const tmp = y - yArray[j];
            dySquaredArray[j] = tmp * tmp;
        }

        let x = -1.0;
        for (let rx = 0; rx < width; rx++) {

            let strength = 0.0;
            for (let l = 0; l < length; l++) {
                const r = x - xArray[l];
                const r2 = r * r + dySquaredArray[l];
                strength += k * qArray[l] / Math.max(r2, smallestPassingDistanceSquared);
            }

            // Pixel color for the field strength.
            // Uint8ClampedArray clamps values to 0-255. I.e. 1000 -> 255, -3.5 -> 0.
            u8buffer[i + 0] = strength; // Red
            u8buffer[i + 1] = Math.abs(strength / 15); // Green
            u8buffer[i + 2] = -strength; // Blue
            u8buffer[i + 3] = 255; // Alpha

            i += 4;
            x += dx;
        }

        y += dy;
    }
}


let wasmRenderScene = undefined;


WebAssembly.instantiateStreaming(fetch('wasm-renderer.wasm'), {}).then(obj => {
    const {renderScene, memory} = obj.instance.exports;

    wasmRenderScene = (width, height, buffer, length, qArray, xArray, yArray) => {

        const availableMemory = memory.buffer.byteLength;
        const neededMemory = width * height * 4 + length * 4 * 4;
        if (availableMemory < neededMemory) {
            memory.grow(Math.ceil((neededMemory - availableMemory) / 65536));
        }

        let offset = 0

        const copy = (src, dst) => {
            if (dst == null) {
                dst = new Float32Array(memory.buffer, offset, length);
                offset += length * Float32Array.BYTES_PER_ELEMENT;
            }
            dst.set(src);
            return dst;
        };

        const qArrayCopy = copy(qArray);
        const xArrayCopy = copy(xArray);
        const yArrayCopy = copy(yArray);
        const dySquaredArray = copy(yArray);
        const sceneBuffer = new Uint32Array(memory.buffer, offset, width * height);

        renderScene(
          width,
          height,
          sceneBuffer.byteOffset,
          length,
          qArrayCopy.byteOffset,
          xArrayCopy.byteOffset,
          yArrayCopy.byteOffset,
          dySquaredArray.byteOffset,
        );

        new Uint32Array(buffer).set(sceneBuffer);
    };
});


onmessage = ({data}) => {
    const { qArray, xArray, yArray, width, height, useWasm } = data;
    const renderScene = (useWasm && wasmRenderScene) ? wasmRenderScene : jsRenderScene;

    let buffer = data.buffer;
    if (buffer == null || buffer.byteLength < width * height * 4) {
        console.log(`Allocating new rendering buffer ${width}x${height}`);
        buffer = data.buffer = new ArrayBuffer(width * height * 4);
    }

    const timestamp = performance.now();
    renderScene(width, height, buffer, qArray.length, qArray, xArray, yArray);
    data.renderDuration = performance.now() - timestamp;

    postMessage(data, [buffer]);
};
