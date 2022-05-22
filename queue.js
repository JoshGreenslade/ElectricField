

export class ThreadedRenderQueue {
    constructor({canvas, maxThreads = 4, stats, useWasm}) {
        // TODO: Safari doesn't have hardwareConcurrency, default to 2 workers in this case.
        this.size = Math.min(Math.max((navigator.hardwareConcurrency || 4) - 2, 1), maxThreads);
        this.useWasm = !!useWasm;
        this.canvas = canvas;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        this.context = canvas.getContext('2d');

        this.lastTimestamp = undefined;
        this.stats = stats;
        stats.init({
            name: 'fps',
            calc: (stats) => {
                const {count, sum} = stats;
                stats.count = stats.sum = 0;
                return count > 0 ? (1000 * count / sum) : undefined;
            },
            precision: 2,
        });
        stats.init({
            name: 'simulation time',
            calc: ({sum}) => sum,
            precision: 4,
            limit: 1,
        });
        stats.init({
            name: 'particles',
            calc: ({last}) => last,
            precision: 0,
            limit: 1,
        });
        stats.init({
            name: 'render load',
            precision: 2,
            unit: '%',
        });
        stats.init({
            name: 'render threads',
            precision: 0,
        });
        stats.init({
            name: 'render duration',
            precision: 2,
            unit: 'ms',
        });
        stats.init({
            name: 'physics duration',
            precision: 2,
            unit: 'ms',
        });
        stats.init({
            name: 'potential energy',
            calc: ({last}) => last,
            precision: 4,
            limit: 1,
        });
        stats.init({
            name: 'kinetic energy',
            calc: ({last}) => last,
            precision: 4,
            limit: 1,
        });
        stats.init({
            name: 'total energy',
            calc: ({last}) => last,
            precision: 4,
            limit: 1,
        });
        stats.particles = 0;

        // Workers can return results out of order, we stamp the tasks with increasing IDs,
        // so we can put them back in order.
        this.nextPushId = 0;
        this.nextPullId = 0;
        this.tasks = [];
        this.buffers = [];

        this.idleWorkers = new Map();
        for (let i = 0; i < this.size; i++) {
            const [name, worker] = this.prepareWorker(i);
            this.idleWorkers.set(name, worker);
            this.buffers.push(new ArrayBuffer(0));
            this.buffers.push(new ArrayBuffer(0));
        }
        this.busyWorkers = new Map();
        this.resultsBuffer = new Map();
    }

    prepareWorker = (i) => {
        const name = `renderWorker${i}`;
        const worker = new Worker('renderer.js', {name});
        worker.addEventListener('message', (e) => this.collectTask(name, worker, e.data));
        return [name, worker];
    };

    collectTask = (workerName, worker, result) => {
        this.busyWorkers.delete(workerName);
        this.idleWorkers.set(workerName, worker);
        this.resultsBuffer.set(result.taskId, result);
        this.tick();
    };

    push = (task) => {
        task.taskId = this.nextPushId++;

        return new Promise((resolve) => {
            this.tasks.push(() => {
                resolve();
                return task;
            });
            this.tick();
        });
    };

    render = (timestamp, {
        qArray, buffer, width, height, renderDuration, physicsDuration, dt, potentialEnergy, kineticEnergy,
    }) => {
        this.nextPullId++;
        const {canvas, stats} = this;

        if (this.lastTimestamp != null) {
            stats.fps = timestamp - this.lastTimestamp;
        }
        stats.renderLoad = 100.0 * this.busyWorkers.size / this.size;
        stats.renderDuration = renderDuration;
        stats.renderThreads = this.size
        stats.physicsDuration = physicsDuration;
        stats.simulationTime = dt;
        stats.particles = qArray.length;
        stats.potentialEnergy = potentialEnergy;
        stats.kineticEnergy = kineticEnergy;
        stats.totalEnergy = potentialEnergy + kineticEnergy;
        this.lastTimestamp = timestamp;

        if (canvas.width === width && canvas.height === height) {
            const u8buffer = new Uint8ClampedArray(buffer);
            const imageData = new ImageData(u8buffer, width, height);
            this.context.putImageData(imageData, 0, 0);
        }

        this.buffers.push(buffer);
        this.tick();
    };

    tick = () => {
        const {buffers, tasks, resultsBuffer, idleWorkers, busyWorkers, useWasm} = this;

        if (resultsBuffer.has(this.nextPullId)) {
            const result = resultsBuffer.get(this.nextPullId);
            resultsBuffer.delete(this.nextPullId);
            requestAnimationFrame((timestamp) => this.render(timestamp, result));
        }

        if (tasks.length > 0 && buffers.length > 0 && idleWorkers.size > 0) {
            const {width, height} = this.canvas;

            for (const [workerName, worker] of idleWorkers) {
                const produce = tasks.shift();
                const task = produce();
                const buffer = buffers.shift();
                task.buffer = buffer;
                task.width = width;
                task.height = height;
                task.useWasm = useWasm;
                worker.postMessage(task, [buffer]);
                idleWorkers.delete(workerName);
                busyWorkers.set(workerName, worker);
                if (tasks.length <= 0 || buffer.length <= 0) {
                    break;
                }
            }
        }
    };
}
