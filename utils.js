module.exports = function() {
    return {
        getFieldVector: function(x, y) {
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
                if (r2 < 1) r2 = 1
                
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
    }
}