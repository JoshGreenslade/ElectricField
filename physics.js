

const k = 50;
const smallestPassingDistance = 5;


function getFieldVector(x, y, qArray, xArray, yArray) {
    // Get the field vector and strength at an arbitrary position in the grid
    let strengthX = 0.0;
    let strengthY = 0.0;

    qArray.forEach((q, i) => {
        const dx = x - xArray[i];
        const dy = y - yArray[i];
        const dx2 = dx * dx;
        const dy2 = dy * dy;
        const r2 = dx2 + dy2;
        const r = Math.sqrt(r2);
        if (r > smallestPassingDistance) {
            const strength = k * q / r2;
            strengthX += strength * dx / r;
            strengthY += strength * dy / r;
        }
    });

    return [strengthX, strengthY];
}


function updateCharges({mArray, qArray, xArray, yArray, vxArray, vyArray, width, height, friction, steps, dt}) {
    if (dt <= 0) {
        return;
    }

    for (let i = 0; i < steps; i++) {
        mArray.forEach((m, i) => {
            if (m === Infinity) {
                return;
            }
            const q = qArray[i];
            const x = xArray[i];
            const y = yArray[i];
            const [strengthX, strengthY] = getFieldVector(x, y, qArray, xArray, yArray);
            const vx = vxArray[i] + strengthX * q * dt / m;
            const vy = vyArray[i] + strengthY * q * dt / m;
            vxArray[i] = vx;
            vyArray[i] = vy;
            xArray[i] += vx * dt;
            yArray[i] += vy * dt;
        });
        walls(mArray, xArray, yArray, vxArray, vyArray, width, height);
    }

    // Friction
    vxArray.forEach((vx, i) => {
        vxArray[i] = vx * (1 - friction);
        vyArray[i] = vyArray[i] * (1 - friction);
    });
}


function walls(mArray, xArray, yArray, vxArray, vyArray, width, height) {
    mArray.forEach((m, i) => {
        if (m === Infinity) {
            return;
        }
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
    });
}


onmessage = (e) => {
    const { data } = e;
    const startTimestamp = performance.now();
    updateCharges(data);
    const endTimestamp = performance.now();
    data.physicsDuration = endTimestamp - startTimestamp;
    postMessage(data);
};
