

import {Configuration} from "./config.js";
import {Stats} from "./stats.js";
import {SimulationDispatcher} from "./simulation.js";
import {ThreadedRenderQueue} from "./queue.js";


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
  const stats = new Stats(document.querySelector('.stats-container .stats-table'));
  const canvas = document.querySelector('canvas');
  const renderer = new ThreadedRenderQueue({
    canvas,
    stats,
    maxThreads: 4,
    useWasm: true,
  });
  const simulation = new SimulationDispatcher({
    configuration,
    renderer,
    useWasm: false,
  });

  function getMousePosition(canvas, e) {
    const {particleGrid} = configuration;
    const rect = canvas.getBoundingClientRect();
    let x = 2.0 * (e.x - rect.x) / (canvas.width - 1) - 1.0;
    let y = -2.0 * (e.y - rect.y) / (canvas.height - 1) + 1.0;
    if (particleGrid > 0) {
      const grid = 2.0 / particleGrid;
      x = Math.round(x / grid) * grid;
      y = Math.round(y / grid) * grid;
    }
    x = Math.max(-1.0, Math.min(1.0, x));
    y = Math.max(-1.0, Math.min(1.0, y));
    return {x, y};
  }

  canvas.addEventListener('mousedown', (e) => {
    const {x, y} = getMousePosition(canvas, e);
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
    toValue: (elem) => {
      const input = parseFloat(elem.value);
      const found = Object.entries(configuration.integrationMethods).filter(([, i]) => i === input);
      return found.length ? found[0][0] : configuration.defaultIntegrationMethod;
    },
    toInput: (elem, method) => {
      method = (method in configuration.integrationMethods)
          ? configuration.integrationMethods[method]
          : configuration.integrationMethods[configuration.defaultIntegrationMethod];
      elem.value = method;
    },
  });
  configuration.bind({
    id: 'time-scale',
    toValue: (elem) => Math.pow(10, parseFloat(elem.value)),
    toInput: (elem, timeScale) => elem.value = Math.log10(timeScale),
    toOutput: (elem, timeScale) => elem.value = `x${timeScale}`,
  });
  configuration.bind({
    id: 'adaptive-time-scale',
    toOutput: (elem, adaptiveTimeScale) => elem.value = (adaptiveTimeScale > 0 ? `1/${adaptiveTimeScale}` : 'off'),
  });
  configuration.bind({
    id: 'particle-charge',
    toOutput: (elem, particleCharge) => elem.value = (particleCharge !== 0 ? particleCharge : 'invalid'),
  });
  configuration.bind({
    id: 'particle-grid',
    toValue: (elem) => parseFloat(elem.value) * 2,
    toOutput: (elem, particleGrid) => elem.value = (particleGrid > 0 ? `${particleGrid}x${particleGrid}` : 'off'),
    toInput: (elem, particleGrid) => elem.value = particleGrid / 2,
  });
  configuration.bind({
    id: 'particle-mass',
    toValue: (elem) => {
      const particleMass = Math.pow(10, parseFloat(elem.value));
      return particleMass >= 10 ? Infinity : particleMass;
    },
    toInput: (elem, particleMass) => elem.value = (particleMass === Infinity ? 10 : Math.log10(particleMass)),
  });
  configuration.bind({
    id: 'medium-friction',
    toValue: (elem) => (Math.pow(2, parseFloat(elem.value)) - 1) / 1023,
    toInput: (elem, mediumFriction) => elem.value = Math.log2(mediumFriction * 1023 + 1),
  });
  configuration.bind({
    id: 'walls-elasticity',
  });
  configuration.bind({
    id: 'reverse-time',
    toValue: (elem) => {
      const reverseTime = elem.reverseTime;
      return (reverseTime === true || reverseTime === false) ? reverseTime : !configuration.defaultReverseTime;
    },
    toInput: (elem, reverseTime) => {
      elem.value = reverseTime ? "Forward" : "Backward";
      elem.reverseTime = !reverseTime;
    },
  });
  const statsContainer = document.querySelector(".stats-container");
  const statsButton = statsContainer.querySelector(".stats-close");
  configuration.bind({
    id: 'show-stats',
    toValue: (elem) => {
      const showStats = elem.showStats;
      return (showStats === true || showStats === false) ? showStats : !configuration.defaultShowStats;
    },
    toInput: (elem, showStats) => {
      elem.showStats = !showStats;
      if (showStats) {
        statsButton.value = "∨";
        statsContainer.classList.remove("hidden");
      } else {
        statsButton.value = "stats";
        statsContainer.classList.add("hidden");
      }
    },
  });

  const pauseButton = document.getElementById("pause");
  pauseButton.addEventListener('click', (e) => {
    simulation.paused = !simulation.paused;
    pauseButton.textContent = simulation.paused ? "Run" : "Pause";
  });
  pauseButton.textContent = simulation.paused ? "Run" : "Pause";

  const stepButton = document.getElementById("step");
  stepButton.addEventListener('click', (e) => {
    simulation.paused = true;
    simulation.step = true;
    pauseButton.textContent = "Run";
  });

  const resetButton = document.getElementById("reset");
  resetButton.addEventListener('click', (e) => {
    configuration.reset();
    simulation.reset();
    stats.reset();
    simulation.paused = true;
    simulation.step = false;
    pauseButton.textContent = "Run";
  });

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
  fileInput.addEventListener('click', (e) => {
    // This is to make sure the change event is fired every time, even when the same file is selected.
    fileInput.value = null;
  });
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
