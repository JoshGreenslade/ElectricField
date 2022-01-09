

class MultiThreadedRenderer {
  constructor({canvas, maxThreads, useWasm}) {
    // Physics is O(n^2) and becomes the bottleneck for the number of particles of 20-30 or above.
    // So upping the number of threads beyond some point becomes of little use. Also, the deeper
    // the queue, the bigger the lag, it becomes visible when user interacts with the canvas.
    // TODO: Safari doesn't have hardwareConcurrency, default to 2 workers in this case.
    this.size = Math.min(Math.max((navigator.hardwareConcurrency || 4) - 2, 1), maxThreads || 4);
    this.canvas = canvas;
    this.useWasm = !!useWasm;
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
    this.particlesStats = this.initStats();
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
    const { context, particlesStats, fpsStats, loadStats, renderStats, physicsStats } = this;
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
    draw('particles', particlesStats.avg, 0);
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
    this.updateStats(qArray.length, this.particlesStats, 1);
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


class Configuration {
  defaultTimeScale = 1;
  defaultMediumFriction = 0;
  defaultIntegrationSteps = 300;
  defaultIntegrationMethod = 'euler';
  defaultParticleMass = 1;
  defaultParticleCharge = 500;
  defaultWallsElasticity = 0.9;

  constructor() {
    this._timeScale = this.defaultTimeScale;
    this._mediumFriction = this.defaultMediumFriction;
    this._integrationSteps = this.defaultIntegrationSteps;
    this._integrationMethod = this.defaultIntegrationMethod;
    this._particleMass = this.defaultParticleMass;
    this._particleCharge = this.defaultParticleCharge;
    this._wallsElasticity = this.defaultWallsElasticity;

    this.controls = {};
  }

  bind = ({id, toValue, toOutput, toInput}) => {
    const [first, ...rest] = id.split(/\W/);
    const words = [first].concat(rest.map((s) => s.substring(0, 1).toUpperCase() + s.substring(1)));
    const name = `${words.join('')}`;
    if (!(name in this)) {
      return;
    }

    toValue = toValue || parseFloat;
    toOutput = toOutput || ((value) => value);
    toInput = toInput || ((value) => value);

    const input = document.getElementById(`${id}-input`);
    const output = document.getElementById(`${id}-output`);

    const setter = (inputValue) => {
      this[name] = toValue(inputValue);
      input.value = toInput(this[name]);
      output.value = toOutput(this[name]);
    };

    input.addEventListener('input', (e) => {
      setter(e.target.value);
      e.preventDefault();
    });

    setter(); // Set the default at first

    this.controls[name] = {setter, toValue, toOutput, toInput};
  };

  reset = () => {
    Object.values(this.controls).forEach(({setter}) => setter());
  };

  load = (parameters) => {
    const {controls} = this;
    Object.keys(parameters).forEach((name) => {
      if (name in controls) {
        const {setter, toValue, toOutput, toInput} = controls[name];
        setter(toInput(parameters[name]));
      }
    });
  };

  save = () => {
    const {controls} = this;
    const parameters = {};
    Object.keys(controls).forEach((name) => {
      parameters[name] = this[`_${name}`];
    });
    return parameters;
  };

  validate = (value, minValue, maxValue, defaultValue, precision) => {
    if (typeof value !== 'number') {
      value = Number(value);
    }
    if (typeof value !== 'number' || isNaN(value)) {
      value = defaultValue;
    }
    if (precision) {
      value = Number(value.toFixed(precision));
    }
    return Math.max(Math.min(value, maxValue), minValue);
  }

  get timeScale() {
    return this._timeScale;
  }

  set timeScale(value) {
    this._timeScale = this.validate(value, 0.01, 10, this.defaultTimeScale, 2);
  }

  get mediumFriction() {
    return this._mediumFriction;
  }

  set mediumFriction(value) {
    this._mediumFriction = this.validate(value, 0.0, 1, this.defaultMediumFriction, 3);
  }

  get wallsElasticity() {
    return this._wallsElasticity;
  }

  set wallsElasticity(value) {
    this._wallsElasticity = this.validate(value, 0, 1, this.defaultWallsElasticity, 2);
  }

  get particleMass() {
    return this._particleMass;
  }

  set particleMass(value) {
    this._particleMass = this.validate(value, 0.1, 10, this.defaultParticleMass, 3);
    if (this._particleMass === 10) {
      this._particleMass = Infinity;
    }
  }

  get particleCharge() {
    return this._particleCharge;
  }

  set particleCharge(value) {
    this._particleCharge = this.validate(value, -1000, 1000, this.defaultParticleCharge, 0);
  }

  get integrationSteps() {
    return this._integrationSteps;
  }

  set integrationSteps(value) {
    this._integrationSteps = this.validate(value, 1, 1000, this.defaultIntegrationSteps, 0);
  }

  get integrationMethod() {
    return this._integrationMethod;
  }

  set integrationMethod(value) {
    if (value !== 'euler' && value !== 'midpoint' && value !== 'heun' && value !== 'rk4') {
      value = this.defaultIntegrationMethod;
    }
    this._integrationMethod = value;
  }
}


class Simulation {
  constructor({configuration, renderer, useWasm}) {
    this.configuration = configuration;
    this.renderer = renderer;
    this.useWasm = !!useWasm;
    this.paused = false;

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

    this.physicsWorker = new Worker("./physics.js", {name: "physicsWorker"});
    this.physicsWorker.addEventListener('message', (e) => this.finishFrame(e.data));
  }

  finishFrame = ({qArray, mArray, xArray, yArray, vxArray, vyArray, physicsDuration}) => {
    const {renderer} = this;
    this.particles = {qArray, mArray, xArray, yArray, vxArray, vyArray};
    renderer.push({qArray, xArray, yArray, physicsDuration}).then(this.initFrame);
  };

  initFrame = () => {
    if (this.update != null) {
      this.update();
      this.update = undefined;
    }

    const {qArray, mArray, xArray, yArray, vxArray, vyArray} = this.particles;
    const {baseSpeed, useWasm} = this;
    const {timeScale, integrationMethod, integrationSteps, mediumFriction, wallsElasticity} = this.configuration;
    const dt = this.paused ? 0 : (timeScale * baseSpeed / integrationSteps);
    this.physicsWorker.postMessage({
      qArray,
      mArray,
      xArray,
      yArray,
      vxArray,
      vyArray,
      // This introduces a rounding error accumulating over internal steps of simulation.
      mediumFriction: mediumFriction > 0 ? Math.pow(1 - mediumFriction, 1 / integrationSteps) : 1,
      integrationMethod,
      integrationSteps,
      dt,
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


function download(filename, data) {
  const blob = new Blob(
    [JSON.stringify(data, undefined, "  ")],
    {type: 'application/json;charset=utf-8;'},
  );
  const url = URL.createObjectURL(blob);
  const a = document.getElementById("file-download");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  a.click();
  URL.revokeObjectURL(url);
}


window.addEventListener('load', () => {
  const configuration = new Configuration();
  const canvas = document.querySelector('canvas');
  const renderer = new MultiThreadedRenderer({
    canvas,
    maxThreads: 4,
    useWasm: true,
  });
  const simulation = new Simulation({
    configuration,
    renderer,
    useWasm: false,
  });

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
    const particleCharge = (e.button !== 0) ? -configuration.particleCharge : configuration.particleCharge;
    if (particleCharge !== 0) {
      simulation.addParticle(x, y, particleCharge, configuration.particleMass);
    }
    e.preventDefault();
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  configuration.bind({
    id: 'integration-steps',
  });
  configuration.bind({
    id: 'integration-method',
    toValue: (input) => ({
      1: 'midpoint',
      2: 'heun',
      3: 'rk4',
    }[input] || 'euler'),
    toInput: (integrationMethod) => ({
      midpoint: 1,
      heun: 2,
      rk4: 3,
    }[integrationMethod] || 0),
  });
  configuration.bind({
    id: 'time-scale',
    toValue: (input) => Math.pow(10, parseFloat(input)),
    toInput: (timeScale) => Math.log10(timeScale),
    toOutput: (timeScale) => `x${timeScale}`,
  });
  configuration.bind({
    id: 'particle-charge',
    toOutput: (particleCharge) => (particleCharge !== 0) ? `${particleCharge}` : '0 ??',
  });
  configuration.bind({
    id: 'particle-mass',
    toValue: (input) => {
      const particleMass = Math.pow(10, parseFloat(input));
      return particleMass >= 10 ? Infinity : particleMass;
    },
    toInput: (particleMass) => (particleMass === Infinity) ? 10 : Math.log10(particleMass),
  });
  configuration.bind({
    id: 'medium-friction',
    toValue: (input) => (Math.pow(2, parseFloat(input)) - 1) / 1023,
    toInput: (mediumFriction) => Math.log2(mediumFriction * 1023 + 1),
  });
  configuration.bind({
    id: 'walls-elasticity',
  });

  const resetButton = document.getElementById("reset");
  resetButton.addEventListener('click', (e) => {
    configuration.reset();
    simulation.reset();
  });

  const pauseButton = document.getElementById("pause");
  pauseButton.addEventListener('click', (e) => {
    simulation.paused = !simulation.paused;
    pauseButton.textContent = simulation.paused ? "Play" : "Pause";
  });
  pauseButton.textContent = simulation.paused ? "Play" : "Pause";

  const saveButton = document.getElementById("save");
  saveButton.addEventListener('click', (e) => {
    simulation.paused = true;
    pauseButton.textContent = "Play";
    const data = {
      configuration: configuration.save(),
      particles: simulation.save(),
    };
    download("electric-field-simulation.json", data);
  });

  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', (e) => {
    fileInput.files[0].text().then((text) => {
      const data = JSON.parse(text);
      if ('configuration' in data && 'particles' in data) {
        configuration.load(data.configuration);
        simulation.load(data.particles);
      }
    });
  });

  const loadButton = document.getElementById("load");
  loadButton.addEventListener('click', (e) => {
    simulation.paused = true;
    pauseButton.textContent = "Play";
    fileInput.click();
  });

  simulation.initFrame();
});
