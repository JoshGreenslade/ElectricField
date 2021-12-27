var canvas
var ctx
var charges
var pixPerCell

const k = 50
const smallestPassingDistanceSquared = 1 ** 2


onmessage = function (e) {
    if ('update' in e.data) {
        for (var key of e.data.update) {
            this[key] = e.data[key]
        }
    } else {
        console.log('Looping')
        canvas = e.data.canvas;
        ctx = canvas.getContext('2d');
        pixPerCell = e.data.pixPerCell;
        charges = e.data.charges;
        loop()
    }
}


function loop() {
    draw()
    requestAnimationFrame(loop)
}

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

function draw() {
    // Clear the canvas
    ctx.clearRect(0,0, canvas.width, canvas.height)

    // Draw each charge
    for (charge of charges) {
        ctx.fillStyle = 'white'
        ctx.fillRect(charge.x, charge.y, 4, 4)
    }
    // // Loop over all pixels on the canvas
    // for (var i=0+pixPerCell/2; i < canvas.width; i +=pixPerCell) {
    //     for (var j=0+pixPerCell/2; j < canvas.height; j += pixPerCell) {
            
    //         let vec = getFieldVector(i, j)
    //         let strength = vec.strength
    //         var fillStyle = ['rgb(', strength*2, ',', strength*2,',', strength*2,')'].join('')
    //         ctx.fillStyle = fillStyle
    //         ctx.fillRect(i-pixPerCell/2, j-pixPerCell/2, pixPerCell, pixPerCell);
    //     }
    // }
}