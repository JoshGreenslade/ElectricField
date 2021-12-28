// Constants
var canvasWidth = 600;
var canvasHeight = 600; 
var allowed_res = [1,2,4,5,8,10,12,15,20,30,40]
var lastTime = 0

const k = 50
const smallestPassingDistanceSquared = 10 ** 2


// Options
var timescale = 1
var pixPerCell = 10
var friction = 0
var charge = 800
var trailLength = 150



// Get the canvas object
var canvas = document.querySelector('canvas');

// Get the inputs
var positiveInput = document.getElementById("positive")
var timescaleInput = document.getElementById("timescale")
var resolutionInput = document.getElementById("resolution")
var frictionInput = document.getElementById("friction")
var chargeInput = document.getElementById("charge")
var trailInput = document.getElementById("trail")
var resetInput = document.getElementById("reset")

// Ensure everything words at different resolutions
if (window.innerWidth < 450) {
    canvasWidth  = 300 
    canvasHeight = 300
    chargeInput.value = 200
    allowed_res = [1,2,4,5,6,10,12,15,20,30]
    document.getElementById("charge_output").innerHTML = "200"
    charge = 200
}
if (window.innerWidth > 450 & window.innerWidth < 850) {
    canvasWidth  = 400 
    canvasHeight = 400
    allowed_res = [1,2,4,5,8,10,16,20,25,40]
}
canvas.width = canvasWidth
canvas.height = canvasHeight
if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)){
    positiveInput.parentElement.className = ''
}

// Do something?
var ctx = canvas.getContext('2d')


// Variables
var lastTime = 0;
var paused = false;
var physicsWorker = new Worker("./physicsfirefox.js")


// Get the position of the top left of the canvas
const canvas_left = canvas.offsetLeft
const canvas_top = canvas.offsetTop

// Create an array to hold items
var charges = [];

// Function to get mouse pos
function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.x - rect.left,
      y: evt.y - rect.top
    };
  }

// Add an event listener for click events
canvas.addEventListener('mousedown', function(e) {
    var res = getMousePos(canvas, e)
    var x = res.x
    var y = res.y
    var charge_sign = (e.button == 0 & positiveInput.checked ) ? 1 : -1;
    // Add a new element to the charges array
    charges.push({
        colour: '#055AFF',
        y: y,
        x: x,
        vy: 0,
        vx: 0,
        q: charge * charge_sign,
        trail : [],
        static: document.getElementById('static').checked
    });
    updateView()
}, false)


canvas.addEventListener("contextmenu", function (event) {
	console.log('context menu prevented');
	event.preventDefault();
})

physicsWorker.addEventListener('message', function (e) {
    charges = e.data.charges
})

physicsWorker.postMessage({
    charges: charges,
    canvasProperties: {'width':canvasWidth, 'height':canvasHeight},
    timescale: timescale,
    friction: friction,
    trailLength: trailLength
})


function updateView() {

    physicsWorker.postMessage({
        charges: charges,
        canvasProperties: {'width':canvasWidth, 'height':canvasHeight} ,
        update: ['charges', 'canvasProperties']
    })
}


// === Control Listeners
timescaleInput.addEventListener('input', function (e) {
    physicsWorker.postMessage({
        timescale: Math.pow(10, e.target.value),
        update: ['timescale']
    })
})

resolutionInput.addEventListener('input', function (e) {
    pixPerCell = closest(allowed_res, parseInt(e.target.value))
})

frictionInput.addEventListener('input', function (e) {
    friction = parseFloat(e.target.value)
    physicsWorker.postMessage({
        friction: friction,
        update: ['friction']
    })
})

chargeInput.addEventListener('input', function (e) {
    charge = parseFloat(e.target.value)
})

trailInput.addEventListener('change', function (e) {
    trailLength = (e.target.checked) ? 150 : 1
    physicsWorker.postMessage({
        trailLength: trailLength,
        update: ['trailLength']
    })
})
resetInput.addEventListener('click', function (e) {
    charges = []
    updateView()
})


function closest(array, num) {
    var i = 0
    var minDif = 1000;
    var ans;
    for (i in array) {
        var dif = Math.abs(num - array[i]);
        if (dif < minDif) {
            minDif = dif
            ans = array[i]
        }
    }
    return ans
}


// ====== Rendering functions
var imgData = ctx.getImageData(0,0, canvas.width, canvas.height)

// onmessage = function (e) {
//     if ('update' in e.data) {
//         for (var key of e.data.update) {
//             this[key] = e.data[key]
//         }
//     } else {
//         canvas = e.data.canvas;
//         ctx = canvas.getContext('2d');
//         pixPerCell = e.data.pixPerCell;
//         charges = e.data.charges;
//         imgData = ctx.getImageData(0,0, canvas.width, canvas.height)
//         loop()
//     }
// }

function getFieldVector(x, y) {
    // Get the field vector and strength at an abritrary position
    // in the grid
    var dx
    var dy
    var dx2
    var dy2
    var r2
    var strength
    var vec = {x:0, y:0, strength:0}
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
    updateView()
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
    for (var charge of charges) {
        ctx.fillStyle = 'white'
        ctx.fillRect(charge.x, charge.y, 1, 1)
    }

    // Draw each trail
    ctx.beginPath()
    for (var charge of charges) {
        if (charge.trail.length > 0){
            ctx.moveTo(charge.trail[0].x, charge.trail[0].y)
            for (var pos of charge.trail) {
                ctx.lineTo(pos['x'], pos['y'])
            }
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
loop()