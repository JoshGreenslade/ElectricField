

const k = 50.0;
const smallestPassingDistanceSquared = 1.0;


function getFieldStrength(x, y, qArray, xArray, dySquaredArray) {
    const length = qArray.length;
    let strength = 0.0;

    let i = 0;
    while (i < length) {
        const dx = x - xArray[i];
        const r = dx * dx + dySquaredArray[i];
        strength += k * qArray[i] / Math.max(r, smallestPassingDistanceSquared);
        i++;
    }

    return strength;
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
        buffer = data.buffer = new ArrayBuffer(width * height * 4);
    }
    const u8buffer = new Uint8ClampedArray(buffer);
    const yLength = yArray.length;
    const dySquaredArray = new Float32Array(yLength);

    let i = 0;
    let y = 0;
    while (y < height) {
        let j = 0;
        while (j < yLength) {
            const dy = y - yArray[j];
            dySquaredArray[j] = dy * dy;
            j++;
        }

        let x = 0;
        while (x < width) {
            const strength = getFieldStrength(x, y, qArray, xArray, dySquaredArray);
            i = drawFieldStrength(strength, u8buffer, i);
            x++;
        }

        y++;
    }

    const endTimestamp = performance.now();
    data.renderDuration = endTimestamp - startTimestamp;
    postMessage(data, [buffer]);
}


onmessage = (e) => draw(e.data);
