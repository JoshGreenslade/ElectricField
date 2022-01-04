

class MultiThreadedRenderer {
  constructor(canvas, maxThreads) {
    // Physics is O(n^2) and becomes the bottleneck for the number of charges of 20-30 or above.
    // So upping the number of threads beyond some point becomes of little use. Also, the deeper
    // the queue, the bigger the lag, it becomes visible when user interacts with the canvas.
    // TODO: Safari doesn't have hardwareConcurrency, default to 2 workers in this case.
    this.size = Math.min(Math.max((navigator.hardwareConcurrency || 4) - 2, 1), maxThreads || 4);
    this.canvas = canvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.context = canvas.getContext('2d');

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

    this.lastTimestamp = undefined;
    this.chargesStats = this.initStats();
    this.fpsStats = this.initStats((sum, count) => 1000 * count / sum);
    this.loadStats = this.initStats();
    this.renderStats = this.initStats();
    this.physicsStats = this.initStats();
  }

  initStats = (calc) => ({
    sum: 0,
    count: 0,
    avg: undefined,
    calc: calc || ((sum, count) => sum / count),
  });

  drawStats = () => {
    const { context, chargesStats, fpsStats, loadStats, renderStats, physicsStats } = this;
    const { width, height } = this.canvas;
    const h = 15;
    const x = 5;
    let y = 15;

    const draw = (title, stat, precision, unit) => {
      if (stat != null) {
        context.fillText(`${title}: ${stat.toFixed(precision)}${unit ? unit : ''}`, x, y);
        y += h;
      }
    };

    context.fillStyle = 'white';
    context.fillText(`canvas: ${width}x${height}`, x, y);
    y += h;
    draw('charges', chargesStats.avg, 0);
    draw('fps', fpsStats.avg, 1);
    context.fillText(`render threads: ${this.size}`, x, y);
    y += h;
    draw('render load', loadStats.avg, 0, '%');
    draw('render time', renderStats.avg, 1, 'ms');
    draw('physics time', physicsStats.avg, 1, 'ms');
  };

  updateStats = (x, stat, limit) => {
    if (x != null) {
      stat.sum += x;
      stat.count++;
      if (stat.count >= limit) {
        stat.avg = stat.calc(stat.sum, stat.count);
        stat.sum = stat.count = 0;
      }
    }
  };

  prepareWorker = (i) => {
    const name = `renderWorker${i}`;
    const worker = new Worker('./renderer.js', {name});
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

  render = (timestamp, {qArray, buffer, width, height, physicsDuration, renderDuration}) => {
    this.nextPullId++;

    if (this.lastTimestamp != null) {
      this.updateStats(timestamp - this.lastTimestamp, this.fpsStats, 30);
    }
    this.updateStats(physicsDuration, this.physicsStats, 30);
    this.updateStats(100.0 * this.busyWorkers.size / this.size, this.loadStats, 30);
    this.updateStats(renderDuration, this.renderStats, 30);
    this.updateStats(qArray.length, this.chargesStats, 1);
    this.lastTimestamp = timestamp;

    const {canvas} = this;
    if (canvas.width === width && canvas.height === height) {
      const u8buffer = new Uint8ClampedArray(buffer);
      const imageData = new ImageData(u8buffer, width, height);
      this.context.putImageData(imageData, 0, 0);
      this.drawStats();
    }

    this.buffers.push(buffer);
    this.tick();
  };

  tick = () => {
    const {buffers, tasks, resultsBuffer, idleWorkers, busyWorkers} = this;

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


class Simulation {
  constructor(renderer) {
    this.renderer = renderer;

    this.baseSpeed = 0.01;
    this.timeScale = 1;
    this.friction = 0;
    this.charge = 800;
    this.mass = 1;
    this.steps = 1000;
    this.charges = {
      qArray: new Float32Array(0),
      mArray: new Float32Array(0),
      xArray: new Float32Array(0),
      yArray: new Float32Array(0),
      vxArray: new Float32Array(0),
      vyArray: new Float32Array(0),
    };
    this.update = undefined;

    this.physicsWorker = new Worker("./physics.js", {name: "physicsWorker"});
    this.physicsWorker.addEventListener('message', (e) => this.finishFrame(e.data));
  }

  finishFrame = ({qArray, mArray, xArray, yArray, vxArray, vyArray, physicsDuration}) => {
    const {renderer} = this;
    this.charges = {qArray, mArray, xArray, yArray, vxArray, vyArray};
    renderer.push({qArray, xArray, yArray, physicsDuration}).then(this.initFrame);
  };

  initFrame = () => {
    if (this.update != null) {
      this.update();
      this.update = undefined;
    }
    const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.charges;
    const {baseSpeed, timeScale, friction, steps} = this;
    const dt = timeScale * baseSpeed / steps;
    this.physicsWorker.postMessage({
      qArray,
      mArray,
      xArray,
      yArray,
      vxArray,
      vyArray,
      friction,
      steps,
      dt,
    });
  };

  reset = () => {
    this.update = () => {
      this.charges = {
        qArray: new Float32Array(0),
        mArray: new Float32Array(0),
        xArray: new Float32Array(0),
        yArray: new Float32Array(0),
        vxArray: new Float32Array(0),
        vyArray: new Float32Array(0),
      };
    };
  }

  addCharge = (x, y, positive) => {
    this.update = () => {
      const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.charges;
      const {charge, mass} = this;
      this.charges = {
        qArray: Float32Array.of(...qArray, positive ? charge : -charge),
        mArray: Float32Array.of(...mArray, mass),
        xArray: Float32Array.of(...xArray, x),
        yArray: Float32Array.of(...yArray, y),
        vxArray: Float32Array.of(...vxArray, 0),
        vyArray: Float32Array.of(...vyArray, 0),
      };
    };
  }
}


window.addEventListener('load', () => {
  // Get the inputs
  const positiveInput = document.getElementById("positive");
  const timescaleInput = document.getElementById("timescale");
  const timescaleOutput = document.getElementById("timescale_output");
  const physicsSubsamplesInput = document.getElementById("physicssubsamples");
  const physicsSubsamplesOutput = document.getElementById("physicssubsamples_output");
  const frictionInput = document.getElementById("friction");
  const frictionOutput = document.getElementById("friction_output");
  const chargeInput = document.getElementById("charge");
  const chargeOutput = document.getElementById("charge_output");
  const massInput = document.getElementById("mass");
  const massOutput = document.getElementById("mass_output");
  const resetInput = document.getElementById("reset");

  const canvas = document.querySelector('canvas');
  const renderer = new MultiThreadedRenderer(canvas, 4);
  const simulation = new Simulation(renderer);

  // Function to get mouse pos
  function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let x = 2.0 * (evt.x - rect.x) / (canvas.width - 1) - 1.0;
    x = Math.max(-1.0, Math.min(1.0, x));
    let y = -2.0 * (evt.y - rect.y) / (canvas.height - 1) + 1.0;
    y = Math.max(-1.0, Math.min(1.0, y));
    return {x, y};
  }

  canvas.addEventListener('mousedown', (e) => {
    const {x, y} = getMousePos(canvas, e);
    const positive = e.button === 0 && positiveInput.checked;
    simulation.addCharge(x, y, positive);
    e.preventDefault();
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // === Control Listeners
  timescaleInput.addEventListener('input', function (e) {
    simulation.timeScale = Math.pow(10, e.target.value);
    if (simulation.timeScale <= 0.01) {
      simulation.timeScale = 0;
    }
    timescaleOutput.value = simulation.timeScale > 0 ? `${simulation.timeScale.toFixed(3)}x` : 'paused';
  });

  physicsSubsamplesInput.addEventListener('input', function (e) {
    simulation.steps = parseInt(e.target.value);
    physicsSubsamplesOutput.value = simulation.steps;
  });

  frictionInput.addEventListener('input', function (e) {
    simulation.friction = parseFloat(e.target.value);
    frictionOutput.value = simulation.friction.toFixed(3);
  });

  chargeInput.addEventListener('input', function (e) {
    simulation.charge = parseFloat(e.target.value);
    chargeOutput.value = simulation.charge;
  });

  massInput.addEventListener('input', function (e) {
    simulation.mass = Math.pow(10, e.target.value);
    if (simulation.mass >= 1000) {
      simulation.mass = Infinity;
    }
    massOutput.value = simulation.mass.toFixed(2);
  });

  resetInput.addEventListener('click', function (e) {
    simulation.reset();
  });

  simulation.initFrame();
});
