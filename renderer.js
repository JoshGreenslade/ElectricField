var canvas
var ctx
var charges
var imgData
var pixPerCell
var lastTime = 0

const k = 50
const smallestPassingDistanceSquared = 10 ** 2


onmessage = function (e) {
    if ('update' in e.data) {
        for (var key of e.data.update) {
            this[key] = e.data[key]
        }
    } else {
        canvas = e.data.canvas;
        ctx = canvas.getContext('2d');
        pixPerCell = e.data.pixPerCell;
        charges = e.data.charges;
        imgData = ctx.getImageData(0,0, canvas.width, canvas.height)
        loop()
    }
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
    }

    return vec
}


function loop() {
    draw()
    requestAnimationFrame(loop)
}

function getColor(dist) {
    return [dist*4, Math.abs(4*dist/10) , -1*dist*4]
}


function draw() {
    // Clear the canvas
    ctx.clearRect(0,0, canvas.width, canvas.height)

    // Set the index
    var index = 0;
    var offset = 0;

    // Render the fields
    for (var i=0+pixPerCell/2; i < canvas.width; i +=pixPerCell) {

        for (var j=0+pixPerCell/2; j < canvas.height; j += pixPerCell) {
            
            let vec = getFieldVector(j, i)
            let strength = vec.strength
            var color = getColor(strength)
            // var color = [255, 255, 255]
            
            // Old method
            // ctx.fillStyle = ['rgb(',color[0],',',color[1],',',color[2],')'].join('')
            // ctx.fillRect(i-pixPerCell/2, j-pixPerCell/2, pixPerCell, pixPerCell)
            for (var k = 0; k < pixPerCell * pixPerCell; k++) {
                offset = (k % pixPerCell) + ((k/pixPerCell) | 0)*canvas.width
                offset *= 4
                imgData.data[index + offset + 0] = color[0]
                imgData.data[index + offset + 1] = color[1]
                imgData.data[index + offset + 2] = color[2]
                imgData.data[index + offset + 3] = 255
            }
            index += 4*pixPerCell
       }
       index += 4 * (pixPerCell-1) * canvas.height
    }
    ctx.putImageData(imgData, 0,0)

    // Draw each charge
    for (charge of charges) {
        ctx.fillStyle = 'white'
        ctx.fillRect(charge.x, charge.y, 1, 1)
    }

    // Draw each trail
    ctx.beginPath()
    for (charge of charges) {
        ctx.moveTo(charge.trail[0].x, charge.trail[0].y)
        for (pos of charge.trail) {
            ctx.lineTo(pos['x'], pos['y'])
        }
    }
    ctx.strokeStyle = 'white'
    ctx.stroke();

    // Draw FPS
    // ctx.font = '60px sans-serif white'
    // var delta = (performance.now() - lastTime)/1000
    // lastTime = performance.now()
    // var fps = 1/delta
    // ctx.fillText('FPS: ' + Math.round(fps, 2), 230, 200)

    


}

