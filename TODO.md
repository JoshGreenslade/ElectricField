
- Find common "stable" and "unstable" self-organised areas

- Do sth with the O(N^2) complexity in both physics engine and rendering. An example could be a form
of space partitioning with a "virtual center of gravity" analogue used for each sector. That should yield
O(N*log(N)) and make a smooth simulation of thousands of particles possible.

- Bring back the particles "trails". They were dropped when rendering code was rewritten.

- A moving charge produces a magnetic field. Magnetic fields effect moving charges.
This simulation doesn't take it into account. Technically, it is a Newtonian gravity
simulator that allows negative masses in order to get repulsive forces.
