
export class SimulationDispatcher {
    constructor({configuration, renderer}) {
        this.configuration = configuration;
        this.renderer = renderer;
        this.paused = true;
        this.busy = false;
        this.pendingUpdate = null;

        this.baseCharge = 0.00001;
        this.baseSpeed = 0.01;
        this.particles = {
            qArray: new Float32Array(0),
            mArray: new Float32Array(0),
            xArray: new Float32Array(0),
            yArray: new Float32Array(0),
            vxArray: new Float32Array(0),
            vyArray: new Float32Array(0),
        };

        this.physicsWorker = new Worker("physics.js", {name: "physicsWorker"});
        this.physicsWorker.addEventListener('message', (e) => this.finishFrame(e.data));
    }

    finishFrame = ({
                       qArray,
                       mArray,
                       xArray,
                       yArray,
                       vxArray,
                       vyArray,
                       physicsDuration,
                       dt,
                       potentialEnergy,
                       kineticEnergy,
                   }) => {
        const {renderer} = this;
        const {particleGrid} = this.configuration;
        const grid = particleGrid > 0 ? (2.0 / particleGrid) : 0;
        this.particles = {qArray, mArray, xArray, yArray, vxArray, vyArray};
        renderer.queue({
            qArray, xArray, yArray, grid, physicsDuration, dt, potentialEnergy, kineticEnergy,
        }).then(() => {
            this.busy = false;
            if (!this.paused || this.pendingUpdate) this.initFrame();
        });
    };

    initFrame = (go) => {
        if (!this.busy) {
            this.busy = true;
            if (this.pendingUpdate) {
                this.pendingUpdate();
                this.pendingUpdate = null;
            }

            const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.particles;
            const {baseSpeed} = this;

            const {
                timeScale,
                reverseTime,
                adaptiveTimeScale,
                integrationMethod,
                integrationSteps,
                mediumFriction,
                wallsElasticity,
            } = this.configuration;
            const dt = (go === false) ? 0.0 : (timeScale * baseSpeed);
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
            });
        }
    };

    reset = () => {
        this.pendingUpdate = () => {
            this.paused = true;
            this.particles = {
                qArray: new Float32Array(0),
                mArray: new Float32Array(0),
                xArray: new Float32Array(0),
                yArray: new Float32Array(0),
                vxArray: new Float32Array(0),
                vyArray: new Float32Array(0),
            };
        };
        this.initFrame(false);
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

        this.pendingUpdate = () => {
            this.particles = {
                qArray: new Float32Array(qArray),
                mArray: new Float32Array(mArray),
                xArray: new Float32Array(xArray),
                yArray: new Float32Array(yArray),
                vxArray: new Float32Array(vxArray),
                vyArray: new Float32Array(vyArray),
            };
        };
        this.initFrame(false);
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
        this.pendingUpdate = () => {
            console.log(`Adding particle x=${x} y=${y} m=${mass} q=${charge}`);
            charge *= this.baseCharge;
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
        this.initFrame(false);
    };
}
