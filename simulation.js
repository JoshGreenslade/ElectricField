
export class SimulationDispatcher {
    constructor({configuration, renderer, useWasm}) {
        this.configuration = configuration;
        this.renderer = renderer;
        this.useWasm = !!useWasm;
        this.paused = false;
        this.step = false;

        this.baseSpeed = 0.01;
        this.particles = {
            qArray: new Float32Array(0),
            mArray: new Float32Array(0),
            xArray: new Float32Array(0),
            yArray: new Float32Array(0),
            vxArray: new Float32Array(0),
            vyArray: new Float32Array(0),
        };
        this.update = undefined;

        this.physicsWorker = new Worker("physics.js", {name: "physicsWorker"});
        this.physicsWorker.addEventListener('message', (e) => this.finishFrame(e.data));
    }

    finishFrame = ({qArray, mArray, xArray, yArray, vxArray, vyArray, physicsDuration, dt}) => {
        const {renderer} = this;
        const {particleGrid} = this.configuration;
        const grid = particleGrid > 0 ? (2.0 / particleGrid) : 0;
        this.particles = {qArray, mArray, xArray, yArray, vxArray, vyArray};
        renderer.push({qArray, xArray, yArray, grid, physicsDuration, dt}).then(this.initFrame);
    };

    initFrame = () => {
        if (this.update != null) {
            this.update();
            this.update = undefined;
        }

        const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.particles;
        const {baseSpeed, useWasm} = this;

        const {
            timeScale, reverseTime, adaptiveTimeScale, integrationMethod, integrationSteps, mediumFriction, wallsElasticity,
        } = this.configuration;
        const dt = (!this.paused || this.step) ? timeScale * baseSpeed : 0;
        this.step = false;
        this.physicsWorker.postMessage({
            qArray,
            mArray,
            xArray,
            yArray,
            vxArray,
            vyArray,
            mediumFriction,
            integrationMethod,
            integrationSteps,
            dt: reverseTime ? -dt : dt,
            adaptiveTimeScale,
            wallsElasticity,
            useWasm,
        });
    };

    reset = () => {
        this.update = () => {
            this.particles = {
                qArray: new Float32Array(0),
                mArray: new Float32Array(0),
                xArray: new Float32Array(0),
                yArray: new Float32Array(0),
                vxArray: new Float32Array(0),
                vyArray: new Float32Array(0),
            };
        };
    };

    load = (particles) => {
        const qArray = [];
        const mArray = [];
        const xArray = [];
        const yArray = [];
        const vxArray = [];
        const vyArray = [];
        particles.forEach(({q, m, x, y, vx, vy}) => {
            qArray.push(q);
            mArray.push(m === null ? Infinity : m);
            xArray.push(x);
            yArray.push(y);
            vxArray.push(vx);
            vyArray.push(vy);
        });

        this.update = () => {
            this.particles = {
                qArray: new Float32Array(qArray),
                mArray: new Float32Array(mArray),
                xArray: new Float32Array(xArray),
                yArray: new Float32Array(yArray),
                vxArray: new Float32Array(vxArray),
                vyArray: new Float32Array(vyArray),
            };
        };
    };

    save = () => {
        const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.particles;
        const particles = [];
        qArray.forEach((q, i) => {
            particles.push({
                q,
                m: mArray[i],
                x: xArray[i],
                y: yArray[i],
                vx: vxArray[i],
                vy: vyArray[i],
            });
        });
        return particles;
    };

    addParticle = (x, y, charge, mass) => {
        this.update = () => {
            const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.particles;
            this.particles = {
                qArray: Float32Array.of(...qArray, charge),
                mArray: Float32Array.of(...mArray, mass),
                xArray: Float32Array.of(...xArray, x),
                yArray: Float32Array.of(...yArray, y),
                vxArray: Float32Array.of(...vxArray, 0),
                vyArray: Float32Array.of(...vyArray, 0),
            };
        };
    };
}
