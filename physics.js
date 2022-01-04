

const k = 0.001;
const smallestPassingDistanceSquared = 0.0003;


function updateCharges({mArray, qArray, xArray, yArray, vxArray, vyArray, friction, steps, dt}) {
    if (dt <= 0) {
        return;
    }

    const length = mArray.length;

    // Chrome on a decent CPU takes here ~15ms for 50 particles and 1000 steps of simulation.
    // Just enough to get 60fps. Inner loop is O(n^2) so 100 particles need 4 times longer,
    // and over 1 gigaflops of throughput - not easy to meet in plain Javascript.
    let i = 0;
    while (i < steps) {
        let j = 0;
        while (j < length) {
            const m = mArray[j];
            if (m !== Infinity) {
                const x = xArray[j];
                const y = yArray[j];

                /* Manually inlined field strength calculation */
                let strengthX = 0.0;
                let strengthY = 0.0;

                let l = 0;
                while (l < length) {
                    if (l !== j) {
                        const dx = x - xArray[l];
                        const dy = y - yArray[l];
                        const dx2 = dx * dx;
                        const dy2 = dy * dy;
                        const r2 = dx2 + dy2;

                        // Code before micro optimization.
                        // Note, that scaling by the k factor was pulled outside the loop.
                        /*
                        const r = Math.sqrt(r2);
                        if (r > smallestPassingDistance) {
                            const strength = k * qArray[l] / r2;
                            strengthX += strength * dx / r;
                            strengthY += strength * dy / r;
                        }
                        */

                        if (r2 >= smallestPassingDistanceSquared) {
                            const tmp = qArray[l] / r2 / Math.sqrt(r2);
                            strengthX += dx * tmp;
                            strengthY += dy * tmp;
                        }
                    }

                    l++;
                }
                /* Manually inlined field strength calculation */

                const tmp2 = k * qArray[j] * dt / m;
                const vx = (vxArray[j] += strengthX * tmp2);
                const vy = (vyArray[j] += strengthY * tmp2);
                xArray[j] += vx * dt;
                yArray[j] += vy * dt;
            }

            j++;
        }
        walls(mArray, xArray, yArray, vxArray, vyArray);

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


function walls(mArray, xArray, yArray, vxArray, vyArray) {
    const length = mArray.length;

    let i = 0;
    while (i < length) {
        const m = mArray[i];
        if (m !== Infinity) {
            const x = xArray[i];
            if (x >= 1.0) {
                vxArray[i] = -0.9 * vxArray[i];
                xArray[i] = 2.0 - x;
            } else if (x <= -1.0) {
                vxArray[i] = -0.9 * vxArray[i];
                xArray[i] = -2.0 - x;
            }
            const y = yArray[i];
            if (y >= 1.0) {
                vyArray[i] = -0.9 * vyArray[i];
                yArray[i] = 2.0 - y;
            } else if (y <= -1.0) {
                vyArray[i] = -0.9 * vyArray[i];
                yArray[i] = -2.0 - y;
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
