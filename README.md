
# Electric fields

Is an app which simulates the [Coulomb forces](https://en.wikipedia.org/wiki/Coulomb%27s_law
) between charged particles in a confined box.
It is a rework of https://github.com/JoshGreenslade/ElectricField

- Works in Chrome / Firefox / Safari
- Zero external dependencies
- Utilizes multiple CPU cores and runs at 60fps at high resolutions
- Choice of integration methods: Euler, Midpoint, Heun, Runge-Kutta and Verlet
- Simulation stepping
- Simulation forward / backward control
- Save / load of the simulation


# Quick start

```
git clone https://github.com/jsiembida/ElectricField.git
python3 -m http.server --directory ElectricField
```

And point your browser to [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
