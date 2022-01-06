

/*
  apt install clang wabt lld binaryen

  clang --target=wasm32 --optimize=4 -nostdlib \
    -Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined -Wall \
    --output wasm-physics.wasm wasm-physics.c
*/


// WASM has a built in sqrt, declaration to hush up the compiler.
float sqrtf(float);


#define k 0.00003f
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
    const int particleNumber,
    float* buffer,
    const int integrationSteps,
    const float dt,
    const float mediumFriction,
    const float wallsElasticity
 ) {
    int offset = 0;
    const float* curMArray = buffer + offset;
    offset += particleNumber;
    const float* curQArray = buffer + offset;
    offset += particleNumber;
    float* curXArray = buffer + offset;
    offset += particleNumber;
    float* curYArray = buffer + offset;
    offset += particleNumber;
    float* curVxArray = buffer + offset;
    offset += particleNumber;
    float* curVyArray = buffer + offset;
    offset += particleNumber;
    float* nextXArray = buffer + offset;
    offset += particleNumber;
    float* nextYArray = buffer + offset;
    offset += particleNumber;
    float* nextVxArray = buffer + offset;
    offset += particleNumber;
    float* nextVyArray = buffer + offset;

    const float vScale = k * dt;

    for (int i = 0; i < integrationSteps; i++) {
        for (int j = 0; j < particleNumber; j++) {
            const float m = curMArray[j];
            const float q = curQArray[j];
            float x = curXArray[j];
            float y = curYArray[j];
            float vx = curVxArray[j];
            float vy = curVyArray[j];

            if (!isinf(m)) {
                /* Manually inlined field strength calculation */
                float strengthX = 0.0f;
                float strengthY = 0.0f;

                for (int l = 0; l < particleNumber; l++) {
                    float dx = x - curXArray[l];
                    float dy = y - curYArray[l];
                    float dx2 = dx * dx;
                    float dy2 = dy * dy;
                    float r2 = dx2 + dy2;

                    if (r2 >= smallestPassingDistanceSquared) {
                        float tmp = curQArray[l] / r2 / sqrtf(r2);
                        strengthX += dx * tmp;
                        strengthY += dy * tmp;
                    }
                }
                /* Manually inlined field strength calculation */

                const float tmp2 = vScale * q / m;
                vx += strengthX * tmp2;
                vy += strengthY * tmp2;
                vx *= mediumFriction;
                vy *= mediumFriction;
                x += vx * dt;
                y += vy * dt;

                /* walls */
                if (x >= 1.0f) {
                    vx *= -wallsElasticity;
                    x = 2.0f - x;
                } else if (x <= -1.0f) {
                    vx *= -wallsElasticity;
                    x = -2.0f - x;
                }
                if (y >= 1.0) {
                    vy *= -wallsElasticity;
                    y = 2.0f - y;
                } else if (y <= -1.0f) {
                    vy *= -wallsElasticity;
                    y = -2.0f - y;
                }
            }

            nextXArray[j] = x;
            nextYArray[j] = y;
            nextVxArray[j] = vx;
            nextVyArray[j] = vy;
        }

        float* tmp1 = curXArray;
        curXArray = nextXArray;
        nextXArray = tmp1;
        float* tmp2 = curYArray;
        curYArray = nextYArray;
        nextYArray = tmp2;
        float* tmp3 = curVxArray;
        curVxArray = nextVxArray;
        nextVxArray = tmp3;
        float* tmp4 = curVyArray;
        curVyArray = nextVyArray;
        nextVyArray = tmp4;
    }
}
