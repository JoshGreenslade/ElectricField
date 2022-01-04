

const k = 0.001;
const smallestPassingDistanceSquared = 0.00003;


function getFieldStrength(x, y, qArray, xArray, dySquaredArray) {
    const length = qArray.length;
    let strength = 0.0;

    for (let i = 0; i < length; i++) {
        const dx = x - xArray[i];
        const r = dx * dx + dySquaredArray[i];
        strength += k * qArray[i] / Math.max(r, smallestPassingDistanceSquared);
    }

    return strength;
}


function draw(data) {
    const startTimestamp = performance.now();

    const {width, height, qArray, xArray, yArray} = data;
    let buffer = data.buffer;
    if (buffer == null || buffer.byteLength < width * height * 4) {
        console.log(`Allocating new rendering buffer ${width}x${height}`);
        buffer = data.buffer = new ArrayBuffer(width * height * 4);
    }
    const u8buffer = new Uint8ClampedArray(buffer);
    const yLength = yArray.length;
    const dySquaredArray = new Float32Array(yLength);

    // TODO sanity checks on size.
    const dy = -2.0 / (height - 1);
    const dx = 2.0 / (width - 1);

    let i = 0;
    let y = 1.0;
    for (let ry = 0; ry < height; ry++) {
        for (let j = 0; j < yLength; j++) {
            const tmp = y - yArray[j];
            dySquaredArray[j] = tmp * tmp;
        }

        let x = -1.0;
        for (let rx = 0; rx < width; rx++) {
            const strength = getFieldStrength(x, y, qArray, xArray, dySquaredArray);

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

    const endTimestamp = performance.now();
    data.renderDuration = endTimestamp - startTimestamp;
    postMessage(data, [buffer]);
}


onmessage = (e) => draw(e.data);
