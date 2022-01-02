

const k = 50;
const smallestPassingDistanceSquared = 1;


function getFieldStrength(x, y, qArray, xArray, dySquaredArray) {
    return qArray.reduce((acc, val, i) => {
        const dx = x - xArray[i];
        const r = dx * dx + dySquaredArray[i];
        return acc + k * val / Math.max(r, smallestPassingDistanceSquared);
    }, 0.0);
}


function drawFieldStrength(strength, buffer, i) {
    const r = strength * 4;
    const g = Math.abs(r/10);
    const b = -r;

    buffer[i + 0] = r;
    buffer[i + 1] = g;
    buffer[i + 2] = b;
    buffer[i + 3] = 255;

    return i + 4;
}


function draw(data) {
    const startTimestamp = performance.now();

    const {width, height, qArray, xArray, yArray} = data;
    let buffer = data.buffer;
    if (buffer == null || buffer.byteLength < width * height * 4) {
        console.log(`Allocating new rendering buffer ${width}x${height}`);
        buffer = new ArrayBuffer(width * height * 4);
    }
    const u8buffer = new Uint8ClampedArray(buffer);

    for (let i = 0, y = 0; y < height; y++) {
        const dySquaredArray = yArray.map(val => (y - val) * (y - val));
        for (let x = 0; x < width; x++) {
            const strength = getFieldStrength(x, y, qArray, xArray, dySquaredArray);
            i = drawFieldStrength(strength, u8buffer, i);
        }
    }

    const endTimestamp = performance.now();
    data.buffer = buffer;
    data.renderDuration = endTimestamp - startTimestamp;
    postMessage(data, [buffer]);
}


onmessage = (e) => draw(e.data);
