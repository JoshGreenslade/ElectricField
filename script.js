// Constants
var canvasWidth = 600;
var canvasHeight = 600; 
var allowed_res = [1,2,4,5,8,10,12,15,20,30,40]

// Options
var timescale = 1
var pixPerCell = 10
var friction = 0
var charge = 800
var trailLength = 150
var minSamples = 5000



// Get the canvas object
var canvas = document.querySelector('canvas');

// Get the inputs
var positiveInput = document.getElementById("positive")
var timescaleInput = document.getElementById("timescale")
var resolutionInput = document.getElementById("resolution")
var physicssubsamplesInput = document.getElementById("physicssubsamples")
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
    console.log('Hello')
}

// Do something?
var offscreen = canvas.transferControlToOffscreen()
// var offscreen = canvas


// Variables
var lastTime = 0;
var paused = false;
var physicsWorker = new Worker("./physics.js")
var renderWorker = new Worker('./renderer.js')


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
    console.log(positiveInput.checked)
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
    renderWorker.postMessage({
        charges: charges,
        update: ['charges']
    })
})

physicsWorker.postMessage({
    charges: charges,
    canvasProperties: {'width':canvasWidth, 'height':canvasHeight},
    timescale: timescale,
    friction: friction,
    trailLength: trailLength,
    minSamples: minSamples
})


renderWorker.postMessage({
    canvas: offscreen,
    charges: charges,
    pixPerCell: pixPerCell
}, [offscreen])


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
    renderWorker.postMessage({
        pixPerCell: pixPerCell,
        update: ['pixPerCell']
    })
})

physicssubsamplesInput.addEventListener('input', function (e) {
    minSamples = parseInt(e.target.value)
    physicsWorker.postMessage({
        minSamples: minSamples,
        update: ['minSamples']
    })
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


