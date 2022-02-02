
import {toNames} from "./utils.js";

export class Stats {
    constructor(container) {
        this._container = container;
        this._stats = [];
        this._timeout = undefined;
    }

    reset = (stats, value) => {
        stats.count = stats.sum = 0;
        stats.last = stats.max = stats.min = undefined;
        stats.value = value;
        return stats;
    };

    resetAll = () => this._stats.forEach((stats) => this.reset(stats));

    init = ({name, calc, limit = 30, format, precision = 1, unit}) => {
        calc = calc || ((stats) => {
            const {count, sum} = stats;
            stats.count = stats.sum = 0;
            return count > 0 ? (sum / count) : undefined;
        });
        format = format || (({value}) => value != null ? `${value.toFixed(precision)}${unit ? unit : ''}` : undefined);

        const {cssName, variableName} = toNames(name);

        const stats = this.reset({calc, format, limit, name, cssName, variableName, precision, unit});
        this._stats.push(stats);

        const set = (x) => {
            stats.count++;
            stats.last = x;
            stats.sum += x;
            const {min, max} = stats;
            if (min == null || min > x) {
                stats.min = x;
            }
            if (max == null || max < x) {
                stats.max = x;
            }
            if (stats.count >= limit) {
                stats.value = calc(stats);
                this.scheduleShow();
            }
        };

        const get = () => {
            return format(stats);
        }

        Object.defineProperty(this, variableName, {get, set});
    };

    scheduleShow = () => {
        if (this._timeout == null) {
            this._timeout = setTimeout(this.show, 100);
        }
    }

    show = () => {
        this._timeout = undefined;

        const container = this._container;
        while (container.firstChild) {
            container.removeChild(container.lastChild);
        }

        this._stats.forEach((stats) => {
            const valueText = stats.format(stats);
            if (valueText != null) {
                const tr = document.createElement('tr');
                const name = document.createElement('td');
                name.className = 'name';
                name.textContent = `${stats.name}:`;
                const value = document.createElement('td');
                value.className = 'value';
                value.textContent = valueText;
                tr.appendChild(name);
                tr.appendChild(value);
                container.appendChild(tr);
            }
        });
    };
}
