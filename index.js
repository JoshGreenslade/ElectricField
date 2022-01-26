

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
    toValue: (input) => {
      const foundMethod = Object.entries(configuration.integrationMethods).filter(([, i]) => i == input);
      return foundMethod.length ? foundMethod[0][0] : configuration.defaultIntegrationMethod;
    },
    toInput: (integrationMethod) => (
      integrationMethod in configuration.integrationMethods
        ? configuration.integrationMethods[integrationMethod]
        : configuration.integrationMethod[configuration.defaultIntegrationMethod]
    ),
  });
  configuration.bind({
    id: 'time-scale',
    toValue: (input) => Math.pow(10, parseFloat(input)),
    toInput: (timeScale) => Math.log10(timeScale),
    toOutput: (timeScale) => `x${timeScale}`,
  });
  configuration.bind({
    id: 'adaptive-time-scale',
    toOutput: (adaptiveTimeScale) => adaptiveTimeScale > 0 ? `1/${adaptiveTimeScale}` : 'off',
  });
  configuration.bind({
    id: 'particle-charge',
    toOutput: (particleCharge) => (particleCharge !== 0) ? `${particleCharge}` : '0 ??',
  });
  configuration.bind({
    id: 'particle-grid',
    toValue: (input) => parseFloat(input) * 2,
    toOutput: (particleGrid) => particleGrid > 0 ? `${particleGrid}x${particleGrid}` : 'off',
    toInput: (particleGrid) => particleGrid / 2,
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
  configuration.bind({
    id: 'reverse-time',
    toValue: (newValue, oldValue) => newValue == null ? oldValue : !oldValue,
    toInput: (reverseTime) => reverseTime ? "Forward" : "Backward",
  });
  const statsContainer = document.querySelector(".stats-container");
  configuration.bind({
    id: 'show-stats',
    toValue: (newValue, oldValue) => newValue == null ? oldValue : !oldValue,
    toInput: (showStats) => {
      if (showStats) {
        statsContainer.classList.remove("hidden");
      } else {
        statsContainer.classList.add("hidden");
      }
    },
  });

  const resetButton = document.getElementById("reset");
  resetButton.addEventListener('click', (e) => {
    configuration.reset();
    simulation.reset();
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
