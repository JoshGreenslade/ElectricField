
- Do sth with the O(N^2) complexity in both physics engine and rendering. An example could be a form
of space partitioning / segmentation. That should yield something close to O(N*log(N)) and make a smooth
simulation of thousands of particles possible.

- A moving charge produces a magnetic field. Magnetic fields effect moving charges.
This simulation doesn't take it into account. Technically, it is a Newtonian gravity
simulator that allows negative masses in order to get repulsive forces.
