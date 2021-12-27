// Constants
const charge = 500
const pixPerCell = 5
const canvasWidth = 400
const canvasHeight = 400

// Get the canvas object
var canvas = document.querySelector('canvas');

// Get the canvas context, in this case 2d. This represents our drawing object
// var ctx = canvas.getContext('bitmaprenderer');

// Set the canvas width and height
canvas.width = canvasWidth  
canvas.height= canvasHeight


// Do something?
var offscreen = canvas.transferControlToOffscreen()


// Variables
var lastTime = 0;
var paused = false;
var physicsWorker = new Worker("/physics.js")
var renderWorker = new Worker('/renderer.js')


// Get the position of the top left of the canvas
canvas_left = canvas.offsetLeft
canvas_top = canvas.offsetTop

// Create an array to hold items
var charges = [];

// Add an event listener for click events
canvas.addEventListener('mousedown', function(e) {
    var x = e.pageX - canvas_left;
    var y = e.pageY - canvas_top;
    console.log(e)
    // Add a new element to the charges array
    charges.push({
        colour: '#055AFF',
        y: y,
        x: x,
        vy: 0,
        vx: 0,
        q: charge
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

renderWorker.postMessage({
    canvas: offscreen,
    charges: charges,
    pixPerCell: pixPerCell
}, [offscreen])

physicsWorker.postMessage({
    charges: charges
})

// renderWorker.postMessage({
//     charges : charges,
//     pixPerCell : pixPerCell,
//     canvas : offscreen,
// }, [offscreen])

function updateView() {
    console.log(charges)

    physicsWorker.postMessage({
        charges: charges,
        update: ['charges']
    })
}




