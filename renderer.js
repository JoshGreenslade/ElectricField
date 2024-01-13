const k = 30000.0;
const minDistance = 0.001;
const minDistanceSquared = minDistance * minDistance;


function jsRenderScene(width, height, buffer, qArray, xArray, yArray, grid) {
    const w = width | 0;
    const h = height | 0;
    const length = qArray.length | 0;
    const u8buffer = new Uint8ClampedArray(buffer);
    const dySquaredArray = new Float32Array(length);

    const dy = 2.0 / (height - 1);
    const dx = 2.0 / (width - 1);

    let i = 0 | 0;
    let y = 1.0;
    for (let ry = 0 | 0; ry < h; ry++) {
        for (let l = 0 | 0; l < length; l++) {
            const tmp = yArray[l] - y;
            dySquaredArray[l] = tmp * tmp;
        }

        let x = -1.0;
        for (let rx = 0 | 0; rx < w; rx++) {
            let strength = 0.0;
            for (let l = 0 | 0; l < length; l++) {
                const tmp = xArray[l] - x;
                const rSquared = tmp * tmp + dySquaredArray[l];
                strength += qArray[l] / Math.max(rSquared, minDistanceSquared);
            }
            strength *= k;

            // Pixel color for the field strength.
            // Uint8ClampedArray clamps values to 0-255. I.e. 1000 -> 255, -3.5 -> 0.
            u8buffer[i] = strength > 0.0 ? Math.sqrt(strength) : 0; // Red
            u8buffer[i + 1] = strength < 0.0 ? Math.sqrt(-strength) : 0; // Green
            u8buffer[i + 2] = 0; // Blue
            u8buffer[i + 3] = 255; // Alpha

            i += 4;
            x += dx;
        }

        y -= dy;
    }

    if (grid > 0) {
        for (let i = 0 | 0, x = -1.0; i < w; i++, x += dx) {
            const diff = Math.abs(Math.round(x / grid) * grid - x);
            if (diff < dx) {
                for (let j = 0 | 0, l = i*4 | 0; j < h; j++, l+=w*4) {
                    u8buffer[l] = u8buffer[l + 1] = u8buffer[l + 2] = u8buffer[l + 3] = 0xa0;
                }
            }
        }
        for (let i = 0 | 0, y = 1.0; i < h; i++, y -= dy) {
            const diff = Math.abs(Math.round(y / grid) * grid - y);
            if (diff < dy) {
                for (let j = 0 | 0, l = i*w*4 | 0; j < w; j++, l+=4) {
                    u8buffer[l] = u8buffer[l + 1] = u8buffer[l + 2] = u8buffer[l + 3] = 0xa0;
                }
            }
        }
    }
}


let wasmRenderScene = undefined;


// WebAssembly.instantiateStreaming expects the server to return WASM file with application/wasm MIME.
// If that doesn't happen, it fails. See: https://github.com/mdn/webassembly-examples/issues/5
fetch('renderer.wasm')
    .then((resp) => resp.arrayBuffer())
    .then((bytes) => WebAssembly.instantiate(bytes, {}))
    .then((obj) => {
        const {renderScene, memory} = obj.instance.exports;

        wasmRenderScene = (width, height, buffer, qArray, xArray, yArray, grid) => {
            let length = qArray.length | 0;
            if (length % 4 > 0) {
                length += 4 - (length % 4);
            }
            const bytesLength = (length * Float32Array.BYTES_PER_ELEMENT) | 0;
            let offset = 0 | 0;

            const availableMemory = memory.buffer.byteLength | 0;
            const neededMemory = (
                width * height * Uint32Array.BYTES_PER_ELEMENT + 4 * bytesLength
            ) | 0;
            if (availableMemory < neededMemory) {
                memory.grow(Math.ceil((neededMemory - availableMemory) / 65536));
            }

            const copyFloats = (src) => {
                const dst = new Float32Array(memory.buffer, offset, length);
                dst.fill(0.0);
                dst.set(src);
                offset += bytesLength;
            };

            copyFloats(qArray);
            copyFloats(xArray);
            copyFloats(yArray);

            const scene = new Uint32Array(
              memory.buffer, offset + bytesLength, width * height
            );
            renderScene(length, width, height, grid);
            new Uint32Array(buffer).set(scene);
        };

        console.log('WASM render backend loaded');
    });


onmessage = ({data}) => {
    const {qArray, xArray, yArray, width, height, useWasm, grid} = data;
    const renderScene = (useWasm && wasmRenderScene) ? wasmRenderScene : jsRenderScene;

    let buffer = data.buffer;
    if (buffer == null || buffer.byteLength !== width * height * Uint32Array.BYTES_PER_ELEMENT) {
        console.log(`Allocating new rendering buffer ${width}x${height}`);
        buffer = data.buffer = new ArrayBuffer(width * height * Uint32Array.BYTES_PER_ELEMENT);
    }

    const timestamp = performance.now();
    renderScene(width, height, buffer, qArray, xArray, yArray, grid);
    data.renderDuration = performance.now() - timestamp;

    postMessage(data, [buffer]);
};
