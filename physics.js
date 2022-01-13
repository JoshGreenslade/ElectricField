

const k = 0.00003;
const smallestPassingDistanceSquared = 0.00003;


const prepareBuffers = (particleNumber, buffersNumber) => {
    const arraySize = particleNumber * Float32Array.BYTES_PER_ELEMENT;
    const buffer = new ArrayBuffer(buffersNumber * arraySize);
    const buffers = [];
    let offset = 0;
    for(let i = 0; i < buffersNumber; i++) {
        buffers.push(new Float32Array(buffer, offset, particleNumber));
        offset += arraySize;
    }
    return buffers;
};


const bounce = (position, velocity, elasticity) => {
    if (position >= 1.0) {
        return [2.0 - position, velocity * -elasticity];
    }
    if (position <= -1.0) {
        return [-2.0 - position, velocity * -elasticity];
    }
    return [position, velocity];
};


const findForces = (
  particleNumber,
  qArray,
  xArray,
  yArray,
  fxArray,
  fyArray,
) => {
    for (let i = 0; i < particleNumber; i++) {
        const x = xArray[i];
        const y = yArray[i];

        let fx = 0.0;
        let fy = 0.0;

        for (let j = 0; j < particleNumber; j++) {
            const dx = x - xArray[j];
            const dy = y - yArray[j];
            const dx2 = dx * dx;
            const dy2 = dy * dy;
            const r2 = dx2 + dy2;

            if (r2 >= smallestPassingDistanceSquared) {
                const tmp = qArray[j] / r2 / Math.sqrt(r2);
                fx += dx * tmp;
                fy += dy * tmp;
            }
        }

        fxArray[i] = fx;
        fyArray[i] = fy;
    }
};


// TODO how to apply friction in methods using intermediate steps? Do we:
// 1. Apply friction to all intermediate steps but do not use it in the final step?
// 2. Apply no friction to intermediate steps and only apply it to the final step?
// 3. Something else? I.e. apply to the intermediate steps and the final step as well?
// Currently we do a mix of the options, depending on the method.
const applyForces = (
  particleNumber,
  mArray,
  qArray,
  xArray,
  yArray,
  vxArray,
  vyArray,
  fxArray,
  fyArray,
  newXArray,
  newYArray,
  newVxArray,
  newVyArray,
  dt,
  mediumFriction,
  wallsElasticity,
) => {
    mediumFriction = (mediumFriction == null) ? 1.0 : mediumFriction;

    for (let i = 0; i < particleNumber; i++) {
        const m = mArray[i];
        const q = qArray[i];
        let x = xArray[i];
        let y = yArray[i];
        let vx = vxArray[i];
        let vy = vyArray[i];
        let fx = fxArray[i];
        let fy = fyArray[i];

        if (m !== Infinity) {
            const tmp = k * dt * q / m;
            vx += fx * tmp;
            vy += fy * tmp;
            vx *= mediumFriction;
            vy *= mediumFriction;
            x += vx * dt;
            y += vy * dt;

            if (wallsElasticity != null) {
                [x, vx] = bounce(x, vx, wallsElasticity);
                [y, vy] = bounce(y, vy, wallsElasticity);
            }
        }

        newXArray[i] = x;
        newYArray[i] = y;
        newVxArray[i] = vx;
        newVyArray[i] = vy;
    }
};


function euler(
  particleNumber,
  mArray,
  qArray,
  curXArray,
  curYArray,
  curVxArray,
  curVyArray,
  integrationSteps,
  dt,
  mediumFriction,
  wallsElasticity,
) {
    let [
        fxArray, fyArray, nextXArray, nextYArray, nextVxArray, nextVyArray,
    ] = prepareBuffers(particleNumber, 6);

    // This implementation is some 20-30% slower than manually unrolled code.
    for (let i = 0; i < integrationSteps; i++) {
        findForces(
          particleNumber,
          qArray,
          curXArray,
          curYArray,
          fxArray,
          fyArray,
        );

        applyForces(
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          fxArray,
          fyArray,
          nextXArray,
          nextYArray,
          nextVxArray,
          nextVyArray,
          dt,
          mediumFriction,
          wallsElasticity,
        );

        [nextXArray, curXArray] = [curXArray, nextXArray];
        [nextYArray, curYArray] = [curYArray, nextYArray];
        [nextVxArray, curVxArray] = [curVxArray, nextVxArray];
        [nextVyArray, curVyArray] = [curVyArray, nextVyArray];
    }

    return [mArray, qArray, curXArray, curYArray, curVxArray, curVyArray];
}


// https://en.wikipedia.org/wiki/Midpoint_method
// This is explicit midpoint
function midpoint(
  particleNumber,
  mArray,
  qArray,
  curXArray,
  curYArray,
  curVxArray,
  curVyArray,
  integrationSteps,
  dt,
  mediumFriction,
  wallsElasticity,
) {
    let [
        fxArray, fyArray, nextXArray, nextYArray, nextVxArray, nextVyArray,
    ] = prepareBuffers(particleNumber, 6);

    for (let i = 0; i < integrationSteps; i++) {
        findForces(
          particleNumber,
          qArray,
          curXArray,
          curYArray,
          fxArray,
          fyArray,
        );

        applyForces( // Find a state half way thru for dt/2
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          fxArray,
          fyArray,
          nextXArray,
          nextYArray,
          nextVxArray,
          nextVyArray,
          dt/2,
          mediumFriction,
        );

        findForces( // Find the forces for that point
          particleNumber,
          qArray,
          nextXArray,
          nextYArray,
          fxArray,
          fyArray,
        );

        applyForces( // Re-apply the forces from the midpoint to initial state
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          fxArray,
          fyArray,
          nextXArray,
          nextYArray,
          nextVxArray,
          nextVyArray,
          dt,
          mediumFriction,
          wallsElasticity,
        );

        [nextXArray, curXArray] = [curXArray, nextXArray];
        [nextYArray, curYArray] = [curYArray, nextYArray];
        [nextVxArray, curVxArray] = [curVxArray, nextVxArray];
        [nextVyArray, curVyArray] = [curVyArray, nextVyArray];
    }

    return [mArray, qArray, curXArray, curYArray, curVxArray, curVyArray];
}


// https://en.wikipedia.org/wiki/Heun%27s_method
function heun(
  particleNumber,
  mArray,
  qArray,
  curXArray,
  curYArray,
  curVxArray,
  curVyArray,
  integrationSteps,
  dt,
  mediumFriction,
  wallsElasticity,
) {
    let [
        aFxArray, aFyArray, bFxArray, bFyArray,
        nextXArray, nextYArray, nextVxArray, nextVyArray,
    ] = prepareBuffers(particleNumber, 8);

    for (let i = 0; i < integrationSteps; i++) {
        findForces( // Find forces in the initial state.
          particleNumber,
          qArray,
          curXArray,
          curYArray,
          aFxArray,
          aFyArray,
        );

        applyForces( // Iterate to the final state, just like in Euler method.
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          aFxArray,
          aFyArray,
          nextXArray,
          nextYArray,
          nextVxArray,
          nextVyArray,
          dt,
          mediumFriction,
        );

        findForces( // Find forces for the final state.
          particleNumber,
          qArray,
          nextXArray,
          nextYArray,
          bFxArray,
          bFyArray,
        );

        // Add the forces and apply them over dt/2 to the initial state.
        for(let i = 0; i < particleNumber; i++) {
            aFxArray[i] += bFxArray[i];
            aFyArray[i] += bFyArray[i];
        }

        applyForces(
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          aFxArray,
          aFyArray,
          nextXArray,
          nextYArray,
          nextVxArray,
          nextVyArray,
          dt/2,
          mediumFriction,
          wallsElasticity,
        );

        [nextXArray, curXArray] = [curXArray, nextXArray];
        [nextYArray, curYArray] = [curYArray, nextYArray];
        [nextVxArray, curVxArray] = [curVxArray, nextVxArray];
        [nextVyArray, curVyArray] = [curVyArray, nextVyArray];
    }

    return [mArray, qArray, curXArray, curYArray, curVxArray, curVyArray];
}


// https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods
function rk4(
  particleNumber,
  mArray,
  qArray,
  curXArray,
  curYArray,
  curVxArray,
  curVyArray,
  integrationSteps,
  dt,
  mediumFriction,
  wallsElasticity,
) {
    let [
        k1XArray, k1YArray, k1VxArray, k1VyArray, k1FxArray, k1FyArray,
        k2XArray, k2YArray, k2VxArray, k2VyArray, k2FxArray, k2FyArray,
        k3XArray, k3YArray, k3VxArray, k3VyArray, k3FxArray, k3FyArray,
        k4XArray, k4YArray, k4VxArray, k4VyArray, k4FxArray, k4FyArray,
        nextXArray, nextYArray, nextVxArray, nextVyArray,
    ] = prepareBuffers(particleNumber, 28);

    for (let i = 0; i < integrationSteps; i++) {
        findForces( // Find forces needed to get k1 derivative based on yn
          particleNumber,
          qArray,
          curXArray,
          curYArray,
          k1FxArray,
          k1FyArray,
        );

        applyForces( // Find yn + dt / 2 * k1
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          k1FxArray,
          k1FyArray,
          k1XArray,
          k1YArray,
          k1VxArray,
          k1VyArray,
          dt/2,
          mediumFriction,
        );

        findForces( // Find forces needed to get k2 derivative based on yn + dt / 2 * k1
          particleNumber,
          qArray,
          k1XArray,
          k1YArray,
          k2FxArray,
          k2FyArray,
        );

        applyForces( // Find yn + dt / 2 * k2
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          k2FxArray,
          k2FyArray,
          k2XArray,
          k2YArray,
          k2VxArray,
          k2VyArray,
          dt/2,
          mediumFriction,
        );

        findForces( // Find forces needed to get k3 derivative based on yn + dt / 2 * k2
          particleNumber,
          qArray,
          k2XArray,
          k2YArray,
          k3FxArray,
          k3FyArray,
        );

        applyForces( // Find yn + dt * k3
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          k3FxArray,
          k3FyArray,
          k3XArray,
          k3YArray,
          k3VxArray,
          k3VyArray,
          dt,
          mediumFriction,
        );

        findForces( // Find forces needed to get k4 derivative based on yn + dt * k3
          particleNumber,
          qArray,
          k3XArray,
          k3YArray,
          k4FxArray,
          k4FyArray,
        );

        applyForces( // Find dt * k4
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          k4FxArray,
          k4FyArray,
          k4XArray,
          k4YArray,
          k4VxArray,
          k4VyArray,
          dt,
          mediumFriction,
        );

        // Re-apply forces in order to find yn + dt * k1,
        // we cannot reuse the dt/2 because of how we apply friction.
        applyForces(
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          k1FxArray,
          k1FyArray,
          k1XArray,
          k1YArray,
          k1VxArray,
          k1VyArray,
          dt,
          mediumFriction,
        );

        // Same for k2. Re-apply the forces for dt.
        applyForces(
          particleNumber,
          mArray,
          qArray,
          curXArray,
          curYArray,
          curVxArray,
          curVyArray,
          k2FxArray,
          k2FyArray,
          k2XArray,
          k2YArray,
          k2VxArray,
          k2VyArray,
          dt,
          mediumFriction,
        );

        // Find the weighted average of the velocities and apply it to the initial positions.
        for(let i = 0; i < particleNumber; i++) {
            const k1Vx = k1VxArray[i];
            const k1Vy = k1VyArray[i];
            const k2Vx = k2VxArray[i];
            const k2Vy = k2VyArray[i];
            const k3Vx = k3VxArray[i];
            const k3Vy = k3VyArray[i];
            const k4Vx = k4VxArray[i];
            const k4Vy = k4VyArray[i];

            let vx = (k1Vx + k2Vx + k2Vx + k3Vx + k3Vx + k4Vx) / 6;
            let vy = (k1Vy + k2Vy + k2Vy + k3Vy + k3Vy + k4Vy) / 6;
            // TODO what to do with the medium friction here? We already applied it to the kN velocities.
            // So it is "baked in" the average anyway.
            let x = curXArray[i] + vx * dt;
            let y = curYArray[i] + vy * dt;

            [x, vx] = bounce(x, vx, wallsElasticity);
            [y, vy] = bounce(y, vy, wallsElasticity);

            nextXArray[i] = x;
            nextYArray[i] = y;
            nextVxArray[i] = vx;
            nextVyArray[i] = vy;
        }

        [nextXArray, curXArray] = [curXArray, nextXArray];
        [nextYArray, curYArray] = [curYArray, nextYArray];
        [nextVxArray, curVxArray] = [curVxArray, nextVxArray];
        [nextVyArray, curVyArray] = [curVyArray, nextVyArray];
    }

    return [mArray, qArray, curXArray, curYArray, curVxArray, curVyArray];
}


const jsCallbacks = {euler, midpoint, heun ,rk4};


const wasmCallbacks = {euler, midpoint, heun, rk4};


function loadWasmCallback(fileName, callbackName) {
    WebAssembly.instantiateStreaming(fetch(fileName), {}).then(obj => {
        const memory = obj.instance.exports.memory;
        const callback = obj.instance.exports[callbackName];

        wasmCallbacks[callbackName] = (
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

            callback(particleNumber, buffer.byteOffset, integrationSteps, dt, mediumFriction, wallsElasticity);

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

        console.log(`WASM ${callbackName} physics loaded`);
    });
}


loadWasmCallback('physics.wasm', 'euler');


function findMaxVelocity(particleNumber, vxArray, vyArray) {
    if (particleNumber > 0) {
        let maxVelocity = vxArray[0] * vxArray[0] + vyArray[0] * vyArray[0];
        for (let i = 1; i < particleNumber; i++) {
            maxVelocity = Math.max(maxVelocity, vxArray[i] * vxArray[i] + vyArray[i] * vyArray[i]);
        }
        return Math.sqrt(maxVelocity);
    }

    return 0.0;
}


function findDtScale(particleNumber, vxArray, vyArray, dt, maxDistance) {
    const v = findMaxVelocity(particleNumber, vxArray, vyArray);
    let distance = v * dt;
    if (distance > maxDistance) {
        // Particles are moving too fast. We need to chop the dt into N, even, smaller pieces.
        // As a safety measure, N is capped to 100.
        return Math.min(Math.ceil(Math.max(distance / maxDistance, 2.0)), 100);
    }
    return 1.0;
}


function adaptiveDt(
  adaptiveTimeScale,
  callback,
  particleNumber,
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
) {
    // adaptiveSize is relative to the scene size of 2.0
    const maxDistance = 2.0 / adaptiveTimeScale;
    const dtScale = findDtScale(particleNumber, vxArray, vyArray, dt, maxDistance);
    const correctedSteps = integrationSteps * dtScale;
    const correctedFriction = mediumFriction > 0 ? Math.pow(1 - mediumFriction, 1 / correctedSteps) : 1;
    const correctedDt = dt / correctedSteps;

    return callback(
      particleNumber,
      mArray,
      qArray,
      xArray,
      yArray,
      vxArray,
      vyArray,
      correctedSteps,
      correctedDt,
      correctedFriction,
      wallsElasticity,
    );
}


onmessage = ({data}) => {
    const {
        mArray,
        qArray,
        xArray,
        yArray,
        vxArray,
        vyArray,
        integrationMethod,
        integrationSteps,
        dt,
        adaptiveTimeScale,
        mediumFriction,
        wallsElasticity,
        useWasm,
    } = data;
    const timestamp = performance.now();
    if (dt !== 0) {
        const callbacks = useWasm ? wasmCallbacks : jsCallbacks;
        let callback = callbacks[integrationMethod] || euler;
        let stepDt = dt;
        let stepFriction = mediumFriction;

        if (adaptiveTimeScale > 0) {
            // Adaptive wrapper receives unchanged dt and friction and recalculates them as needed.
            callback = adaptiveDt.bind(this, adaptiveTimeScale, callback);
        } else {
            stepDt = dt / integrationSteps;
            stepFriction = mediumFriction > 0 ? Math.pow(1 - mediumFriction, 1 / integrationSteps) : 1;
        }

        const [newMArray, newQArray, newXArray, newYArray, newVxArray, newVyArray] = callback(
          mArray.length,
          mArray,
          qArray,
          xArray,
          yArray,
          vxArray,
          vyArray,
          integrationSteps,
          stepDt,
          stepFriction,
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
