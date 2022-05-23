const k = 10000;
const smallestPassingDistanceSquared = 0.000003;


function jsRenderScene(width, height, buffer, length, qArray, xArray, yArray, grid) {
    const u8buffer = new Uint8ClampedArray(buffer);
    const dySquaredArray = new Float32Array(length);

    const dy = 2.0 / (height - 1);
    const dx = 2.0 / (width - 1);

    let xGridPoints = new Uint8Array(width);
    let yGridPoints = new Uint8Array(height);

    if (grid > 0) {
        for (let i = 0, x = -1.0; i < width; i++) {
            const diff = Math.abs(Math.round(x / grid) * grid - x);
            xGridPoints[i] = (diff < dx) ? 1 : 0;
            x += dx;
        }
        for (let i = 0, y = 1.0; i < height; i++) {
            const diff = Math.abs(Math.round(y / grid) * grid - y);
            yGridPoints[i] = (diff < dy) ? 1 : 0;
            y -= dy;
        }
    } else {
        xGridPoints.fill(0);
        yGridPoints.fill(0);
    }

    let i = 0;
    let y = 1.0;
    for (let ry = 0; ry < height; ry++) {

        const yGrid = yGridPoints[ry] !== 0;

        for (let j = 0; j < length; j++) {
            const tmp = y - yArray[j];
            dySquaredArray[j] = tmp * tmp;
        }

        let x = -1.0;
        for (let rx = 0; rx < width; rx++) {

            if (yGrid && xGridPoints[rx] !== 0) {
                u8buffer[i + 0] = 255;
                u8buffer[i + 1] = 255;
                u8buffer[i + 2] = 255;
                u8buffer[i + 3] = 255;
            } else {
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
            }

            i += 4;
            x += dx;
        }

        y -= dy;
    }
}


let wasmRenderScene = undefined;


// WebAssembly.instantiateStreaming expects the server to return WASM file with application/wasm MIME.
// If that doesn't happen, it fails. See: https://github.com/mdn/webassembly-examples/issues/5
fetch('renderer.wasm')
    .then((resp) => resp.arrayBuffer())
    .then((bytes) => WebAssembly.instantiate(bytes))
    .then((obj) => {
        const {renderScene, memory} = obj.instance.exports;

        wasmRenderScene = (width, height, buffer, length, qArray, xArray, yArray, grid) => {

            const availableMemory = memory.buffer.byteLength;
            const neededMemory = (
                width * height * Uint32Array.BYTES_PER_ELEMENT
                + length * Float32Array.BYTES_PER_ELEMENT * 4
                + width + height
            );
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

            const sceneBuffer = new Uint32Array(memory.buffer, offset, width * height);
            offset += width * height * Uint32Array.BYTES_PER_ELEMENT;
            copy(qArray);
            copy(xArray);
            copy(yArray);

            renderScene(width, height, length, grid, buffer);

            new Uint32Array(buffer).set(sceneBuffer);
        };

        console.log('WASM render backend loaded');
    });


onmessage = ({data}) => {
    const {qArray, xArray, yArray, width, height, useWasm, grid} = data;
    const renderScene = (useWasm && wasmRenderScene) ? wasmRenderScene : jsRenderScene;

    let buffer = data.buffer;
    if (buffer == null || buffer.byteLength != width * height * Uint32Array.BYTES_PER_ELEMENT) {
        console.log(`Allocating new rendering buffer ${width}x${height}`);
        buffer = data.buffer = new ArrayBuffer(width * height * Uint32Array.BYTES_PER_ELEMENT);
    }

    const timestamp = performance.now();
    renderScene(width, height, buffer, qArray.length, qArray, xArray, yArray, grid);
    data.renderDuration = performance.now() - timestamp;

    postMessage(data, [buffer]);
};
