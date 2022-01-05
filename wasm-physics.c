

/*
  apt install clang wabt lld binaryen

  clang --target=wasm32 --optimize=4 -nostdlib \
    -Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined -Wall \
    --output wasm-physics.wasm wasm-physics.c
*/


// WASM has a built in sqrt, declaration to hush up the compiler.
float sqrtf(float);


#define k 0.001f
#define smallestPassingDistanceSquared 0.0003f


// From https://git.musl-libc.org/cgit/musl/tree/src/math/__fpclassifyf.c
int isinf(float x) {
    /* Clang optimizes this coercion to sth that looks like a no-op:
        (i32.reinterpret_f32
         (local.get $0))
    */
	unsigned int u = *((unsigned int *)&x);
	int e = (u >> 23) & 0xff;
	return e == 0xff;
}


extern void updateCharges(
    const int length,
    const float* mArray,
    const float* qArray,
    float* xArray,
    float* yArray,
    float* vxArray,
    float* vyArray,
    const int steps,
    const float dt,
    float friction
 ) {
    const float vScale = k * dt;

    for (int i = 0; i < steps; i++) {
        for (int j = 0; j < length; j++) {
            const float m = mArray[j];
            if (isinf(m)) {
                continue;
            }

            float x = xArray[j];
            float y = yArray[j];

            /* Manually inlined field strength calculation */
            float strengthX = 0.0f;
            float strengthY = 0.0f;

            for (int l = 0; l < length; l++) {
                float dx = x - xArray[l];
                float dy = y - yArray[l];
                float dx2 = dx * dx;
                float dy2 = dy * dy;
                float r2 = dx2 + dy2;

                if (r2 >= smallestPassingDistanceSquared) {
                    float tmp = qArray[l] / r2 / sqrtf(r2);
                    strengthX += dx * tmp;
                    strengthY += dy * tmp;
                }
            }
            /* Manually inlined field strength calculation */

            const float tmp2 = vScale * qArray[j] / m;
            float vx = vxArray[j] + strengthX * tmp2;
            float vy = vyArray[j] + strengthY * tmp2;
            vx *= friction;
            vy *= friction;
            x += vx * dt;
            y += vy * dt;

            /* walls */
            if (x >= 1.0f) {
                vx *= -0.9f;
                x = 2.0f - x;
            } else if (x <= -1.0f) {
                vx *= -0.9f;
                x = -2.0f - x;
            }
            if (y >= 1.0) {
                vy *= -0.9f;
                y = 2.0f - y;
            } else if (y <= -1.0f) {
                vy *= -0.9f;
                y = -2.0f - y;
            }

            xArray[j] = x;
            yArray[j] = y;
            vxArray[j] = vx;
            vyArray[j] = vy;
        }
    }
}
