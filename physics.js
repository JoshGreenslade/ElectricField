var charges
var canvasProperties
var lastTime = 0

const trailLength = 150
const smallestPassingDistanceSquared = 10 ** 2
const k = 50
const subSteps = 1000
const friction = 1
const timescale = 5

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
    }

    return vec
}

function updateCharges(){
    deltaTime = (performance.now() - lastTime)/1000
    lastTime = performance.now()
    dt = timescale * deltaTime / subSteps

    for (var i = 0; i < subSteps; i++) {
        for (var charge of charges) {
            fieldVector = getFieldVector(charge.x, charge.y)
            charge.vx += fieldVector.x * charge.q * dt
            charge.vy += fieldVector.y * charge.q * dt

            // Limit to a maximum speed
            if (Math.abs(charge.vx) > 1000) charge.vx *= 0.9
            if (Math.abs(charge.vy) > 1000) charge.vy *= 0.9

            charge.x += charge.vx * dt
            charge.y += charge.vy * dt

        }
        _walls()
    }

    // Add to the trail
    for (var charge of charges) {
        charge.trail.push({
            x: charge.x,
            y: charge.y
        })
        if (charge.trail.length > trailLength) charge.trail = charge.trail.slice(charge.trail.length - trailLength)
    }

    // Friction
    for (var charge of charges) {
        charge.vx *= friction
        charge.vy *= friction
    }
    
}

function _walls() {
    // Temp walls function
    for (var charge of charges) {
        if (charge.x >= canvasProperties['width']) {
            charge.vx = -1* charge.vx
            charge.x = 2*canvasProperties['width'] - charge.x 
        }
        if (charge.x <= 0) {
            charge.vx = -1* charge.vx
            charge.x = 0 - charge.x
        }
        if (charge.y >= canvasProperties['height']) {
            charge.vy = -1* charge.vy
            charge.y = 2*canvasProperties['height'] - charge.y
        }
        if (charge.y <= 0) {
            charge.vy = -1* charge.vy
            charge.y = 0 - charge.y
        }
    }
}

// function _circleWall() {
//     for (var charge of charges) {
//         if (charge.x * charge.x + charge.y * charge.y >= canvasProperties['width']/2) {

//         }
// }

function getKE() {
    KE = 0
    for (charge of charges) {
        KE += (charge.vx * charge.vx) + (charge.vy * charge.vy)
    }
    return KE
}

// function getPE() {
//     PE = 0
//     for (charge of charges) {
//         for (otherCharge of charges){
//             if (charge != otherCharge) 
//             {
//                 PE += 1/
//             }
//         }
//     }
//     return KE
// }
function loop() {
    updateCharges()
    postMessage({
        charges: charges
    })
    requestAnimationFrame(loop)
}

onmessage = function (e) {
    charges = e.data.charges
    canvasProperties = e.data.canvasProperties
    loop()
}