

export class ThreadedRenderQueue {
    constructor({canvas, maxThreads = 4, stats, useWasm}) {
        // TODO: Safari doesn't have hardwareConcurrency, default to 2 workers in this case.
        this.size = Math.min(Math.max((navigator.hardwareConcurrency || 4) - 2, 1), maxThreads);
        this.useWasm = !!useWasm;
        this.canvas = canvas;
        // canvas.clientWidth and canvas.clientHeight props are controlled in CSS that is responsive.
        // canvas.width and canvas.height must be kept in sync with canvas.clientWidth and canvas.clientHeight
        // as user resizes the page window.
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
            name: 'frames drawn',
            calc: ({count}) => count,
            precision: 0,
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
            precision: 6,
            limit: 1,
        });
        stats.init({
            name: 'kinetic energy',
            calc: ({last}) => last,
            precision: 6,
            limit: 1,
        });
        stats.init({
            name: 'total energy',
            calc: ({last}) => last,
            precision: 6,
            limit: 1,
        });
        stats.particles = 0;

        // Workers can return results out of order, we stamp the tasks with increasing IDs,
        // so we can put them back in order.
        this.nextPushId = 0 | 0;
        this.nextPullId = 0 | 0;
        this.buffers = [];

        this.idleWorkers = new Map();
        for (let i = 0; i < this.size; i++) {
            const name = `renderWorker${i}`;
            const worker = new Worker('renderer.js', {name});
            worker.addEventListener('message', (e) => this.collectTask(name, worker, e.data));
            this.idleWorkers.set(name, worker);
            this.buffers.push(new ArrayBuffer(0));
        }
        this.busyWorkers = new Map();
        this.resultsBuffer = new Map();
        this.pendingTask = null;
    }

    collectTask = (workerName, worker, result) => {
        this.busyWorkers.delete(workerName);
        this.idleWorkers.set(workerName, worker);
        this.resultsBuffer.set(result.taskId, result);
        this.tick();
    };

    queue = (task) => {
        task.taskId = this.nextPushId;
        this.nextPushId = (this.nextPushId + 1) & 0xffffffff;

        if (this.buffers.length > 0) {
            this.push(task);
            return new Promise((resolve) => {
                resolve();
                this.tick();
            });
        }

        if (this.pendingTask == null) {
            return new Promise((resolve) => {
                this.pendingTask = () => {
                    resolve();
                    return task;
                };
                this.tick();
            });
        }
    };

    push = (task) => {
        const {idleWorkers, busyWorkers, useWasm} = this;
        const {width, height} = this.canvas;

        for (const [workerName, worker] of idleWorkers) {
            task.buffer = this.buffers.shift();
            task.width = width;
            task.height = height;
            task.useWasm = useWasm;
            idleWorkers.delete(workerName);
            busyWorkers.set(workerName, worker);
            worker.postMessage(task, [task.buffer]);
            break;
        }
    };

    render = (timestamp, {
        qArray, buffer, width, height, renderDuration, physicsDuration, dt, potentialEnergy, kineticEnergy,
    }) => {
        this.nextPullId = (this.nextPullId + 1) & 0xffffffff;
        const {canvas, stats} = this;
        const {width: canvasWidth, height: canvasHeight, clientWidth, clientHeight} = canvas;

        if (this.lastTimestamp != null) {
            stats.fps = timestamp - this.lastTimestamp;
        }
        // +1 in order to account for the frame that's being rendered in here
        stats.renderLoad = 100.0 * (this.size - this.buffers.length) / this.size;
        stats.renderDuration = renderDuration;
        stats.renderThreads = this.size
        stats.physicsDuration = physicsDuration;
        stats.simulationTime = dt;
        stats.framesDrawn += 1;
        stats.particles = qArray.length;
        stats.potentialEnergy = potentialEnergy;
        stats.kineticEnergy = kineticEnergy;
        stats.totalEnergy = potentialEnergy + kineticEnergy;
        this.lastTimestamp = timestamp;
        if (width === canvasWidth && height === canvasHeight) {
            const u8buffer = new Uint8ClampedArray(buffer);
            const imageData = new ImageData(u8buffer, width, height);
            this.context.putImageData(imageData, 0, 0);
        }

        if (canvasWidth !== clientWidth || canvasHeight !== clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }

        this.buffers.push(buffer);
        this.tick();
    };

    tick = () => {
        const {resultsBuffer, buffers} = this;

        if (resultsBuffer.has(this.nextPullId)) {
            const result = resultsBuffer.get(this.nextPullId);
            resultsBuffer.delete(this.nextPullId);
            requestAnimationFrame((timestamp) => this.render(timestamp, result));
        }

        if (buffers.length && this.pendingTask) {
            this.push(this.pendingTask());
            this.pendingTask = null;
        }
    };
}
