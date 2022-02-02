
import {toNames} from "./utils.js";

export class Configuration {
    integrationMethods = {
        euler: 0,
        midpoint: 1,
        heun: 2,
        rk4: 3,
        verlet: 4,
    };

    defaultTimeScale = 1;
    defaultReverseTime = false;
    defaultAdaptiveTimeScale = 3000;
    defaultMediumFriction = 0;
    defaultIntegrationSteps = 1;
    defaultIntegrationMethod = 'verlet';
    defaultParticleMass = 1;
    defaultParticleCharge = 1;
    defaultParticleGrid = 0;
    defaultWallsElasticity = 1;
    defaultShowStats = false;

    constructor() {
        this._timeScale = this.defaultTimeScale;
        this._adaptiveTimeScale = this.defaultAdaptiveTimeScale;
        this._reverseTime = this.defaultReverseTime;
        this._mediumFriction = this.defaultMediumFriction;
        this._integrationSteps = this.defaultIntegrationSteps;
        this._integrationMethod = this.defaultIntegrationMethod;
        this._particleMass = this.defaultParticleMass;
        this._particleCharge = this.defaultParticleCharge;
        this._particleGrid = this.defaultParticleGrid;
        this._wallsElasticity = this.defaultWallsElasticity;
        this._showStats = this.defaultShowStats;

        this.controls = {};
    }

    bind = ({id, toValue, toOutput, toInput}) => {
        const {variableName: name} = toNames(id)
        if (!(name in this)) {
            return undefined;
        }

        toValue = toValue || ((elem) => parseFloat(elem.value));
        toOutput = toOutput || ((elem, value) => elem.value = value);
        toInput = toInput || ((elem, value) => elem.value = value);

        const input = document.getElementById(`${id}-input`);
        const output = document.getElementById(`${id}-output`);

        const setter = (value) => {
            this[name] = value;
            value = this[name];
            toInput(input, value);
            if (output != null) {
                toOutput(output, value);
            }
        };

        const eventType = (input instanceof HTMLInputElement && input.type !== 'button') ? 'input' : 'click';
        input.addEventListener(eventType, (e) => {
            setter(toValue(e.target));
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
                controls[name].setter(parameters[name]);
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

    get reverseTime() {
        return this._reverseTime;
    }

    set reverseTime(value) {
        this._reverseTime = !!value;
    }

    get adaptiveTimeScale() {
        return this._adaptiveTimeScale;
    }

    set adaptiveTimeScale(value) {
        this._adaptiveTimeScale = this.validate(value, 0, 10000, this.defaultAdaptiveTimeScale, 0);
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
        this._particleCharge = this.validate(value, -10, 10, this.defaultParticleCharge, 1);
    }

    get particleGrid() {
        return this._particleGrid;
    }

    set particleGrid(value) {
        this._particleGrid = this.validate(value, 0, 20, this.defaultParticleGrid, 0);
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
        if (value == null || (!value in this.integrationMethods)) {
            value = this.defaultIntegrationMethod;
        }
        this._integrationMethod = value;
    }

    get showStats() {
        return this._showStats;
    }

    set showStats(value) {
        this._showStats = !!value;
    }
}
