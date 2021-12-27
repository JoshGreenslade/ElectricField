var charges
var lastTime = 0
const smallestPassingDistanceSquared = 1 ** 2
const k = 10
const subSteps = 10

function getFieldVector(x, y) {
    // Get the field vector and strength at an abritrary position
    // in the grid
    vec = {x:0, y:0, strength:0}
    for (var charge of charges) {
        dx = (x - charge.x)
        dx2 = dx * dx;
        dy = (y - charge.y)
        dy2 = dy * dy
        r2 = dx2 + dy2
        // Check to ensure r2 is > 0
        if (r2 < smallestPassingDistanceSquared) r2 = smallestPassingDistanceSquared
        
        // Calculate the field strength due to this charge
        strength = k * charge.q / (r2)

        // Add it to the field vectors
        vec.x += strength * (dx2/r2) * Math.sign(dx)
        vec.y += strength * (dy2/r2) * Math.sign(dy)
        vec.strength += strength
        // console.log(vec)
    }

    return vec
}

function updateCharges(){
    deltaTime = (performance.now() - lastTime)/1000
    lastTime = performance.now()
    dt = deltaTime / subSteps

    
    for (var i = 0; i < subSteps; i++) {
        for (var charge of charges) {
            fieldVector = getFieldVector(charge.x, charge.y)
            charge.vx += fieldVector.x * charge.q * dt
            charge.vy += fieldVector.y * charge.q * dt
            charge.x += charge.vx * dt
            charge.y += charge.vy * dt
        }
    for (var charge of charges) {
        charge.vx *= 0.9999
        charge.vy *= 0.9999
    }
    }

    _walls()
}

function _walls() {
    // Temp walls function
    for (var charge of charges) {
        if (charge.x >= 300) {
            charge.vx = -1* charge.vx
            charge.x = 300
        }
        if (charge.x <= 0) {
            charge.vx = -1* charge.vx
            charge.x = 0
        }
        if (charge.y >= 300) {
            charge.vy = -1* charge.vy
            charge.y = 300
        }
        if (charge.y <= 0) {
            charge.vy = -1* charge.vy
            charge.y = 0
        }
    }
}


function loop() {
    updateCharges()
    postMessage({
        charges: charges
    })
    requestAnimationFrame(loop)
}

onmessage = function (e) {
    charges = e.data.charges
    loop()
}