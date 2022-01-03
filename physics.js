

const k = 50;
const smallestPassingDistance = 5;


function getFieldVector(x, y, qArray, xArray, yArray) {
    // Get the field vector and strength at an arbitrary position in the grid
    const length = qArray.length;
    let strengthX = 0.0;
    let strengthY = 0.0;

    let i = 0;
    while (i < length) {
        const dx = x - xArray[i];
        const dy = y - yArray[i];
        const dx2 = dx * dx;
        const dy2 = dy * dy;
        const r2 = dx2 + dy2;
        const r = Math.sqrt(r2);
        if (r > smallestPassingDistance) {
            const strength = k * qArray[i] / r2;
            strengthX += strength * dx / r;
            strengthY += strength * dy / r;
        }

        i++;
    }

    return [strengthX, strengthY];
}


function updateCharges({mArray, qArray, xArray, yArray, vxArray, vyArray, width, height, friction, steps, dt}) {
    if (dt <= 0) {
        return;
    }

    const length = mArray.length;

    let i = 0;
    while (i < steps) {
        let j = 0;
        while (j < length) {
            const m = mArray[j];
            if (m !== Infinity) {
                const q = qArray[j];
                const x = xArray[j];
                const y = yArray[j];
                const [strengthX, strengthY] = getFieldVector(x, y, qArray, xArray, yArray);
                const vx = vxArray[j] + strengthX * q * dt / m;
                const vy = vyArray[j] + strengthY * q * dt / m;
                vxArray[j] = vx;
                vyArray[j] = vy;
                xArray[j] += vx * dt;
                yArray[j] += vy * dt;
            }

            j++;
        }
        walls(mArray, xArray, yArray, vxArray, vyArray, width, height);

        i++;
    }

    if (friction > 0) {
        friction = 1 - friction;
        let i = 0;
        while (i < length) {
            vxArray[i] *= friction;
            vyArray[i] *= friction;

            i++;
        }
    }
}


function walls(mArray, xArray, yArray, vxArray, vyArray, width, height) {
    const length = mArray.length;

    let i = 0;
    while (i < length) {
        const m = mArray[i];
        if (m !== Infinity) {
            const x = xArray[i];
            if (x >= width) {
                vxArray[i] = -0.9 * vxArray[i];
                xArray[i] = width + width - x;
            } else if (x <= 0) {
                vxArray[i] = -0.9 * vxArray[i];
                xArray[i] = -x;
            }
            const y = yArray[i];
            if (y >= height) {
                vyArray[i] = -0.9 * vyArray[i];
                yArray[i] = height + height - y;
            } else if (y <= 0) {
                vyArray[i] = -0.9 * vyArray[i];
                yArray[i] = -y;
            }
        }

        i++;
    }
}


onmessage = (e) => {
    const { data } = e;
    const startTimestamp = performance.now();
    updateCharges(data);
    const endTimestamp = performance.now();
    data.physicsDuration = endTimestamp - startTimestamp;
    postMessage(data);
};
