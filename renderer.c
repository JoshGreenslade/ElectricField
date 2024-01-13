

/*
  apt install clang lld wabt binaryen

  Annoyingly, clang-15 produces code that doesn't work as expected. Clang-13 and 14 seem ok.

  clang-14 -O3 -fno-builtin-memset -ffast-math --target=wasm32 -msimd128 \
    -nostdlib -Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined \
    -Wall --output renderer.wasm renderer.c
*/


#include <wasm_simd128.h>


// Clang will use f32.nearest for this.
extern float rintf(float);
extern float nearbyintf(float);


#define k 30000.0f
#define minDistanceSquared 0.000001f


static __inline__ v128_t* v128_pointer(const void *__mem) {
  struct __coerce_to_v128_t_struct {
    __v128_u __v;
  } __attribute__((__packed__, __may_alias__));
  return (v128_t*)(&(((struct __coerce_to_v128_t_struct *)__mem)->__v));
}


extern void renderScene(const int length, const int width, const int height, const float grid) {
    const int simdLength = length >> 2;
    float* qArray = (float*)0;
    const v128_t* qArray128 = v128_pointer(qArray);
    float* xArray = qArray + length;
    const v128_t* xArray128 = v128_pointer(xArray);
    float* yArray = xArray + length;
    const v128_t* yArray128 = v128_pointer(yArray);
    float* dySquaredArray = yArray + length;
    v128_t* dySquaredArray128 = v128_pointer(dySquaredArray);
    int* scene = (int*)(dySquaredArray + length);

    const float dy = 2.0f / (height - 1);
    const float dx = 2.0f / (width - 1);
    float x, y;

    const v128_t minDistanceSquared128 = wasm_f32x4_splat(minDistanceSquared);
    const v128_t zero128 = wasm_f32x4_splat(0.0f);
    const v128_t ffff128 = wasm_f32x4_splat(65535.0f);

    int i = 0;
    y = 1.0f;
    for (int ry = 0; ry < height; ry++) {
        const v128_t y128 = wasm_f32x4_splat(y);
        for (int l = 0; l < simdLength; l++) {
            v128_t tmp = wasm_f32x4_sub(yArray128[l], y128);
            dySquaredArray128[l] = wasm_f32x4_mul(tmp, tmp);
        }

        x = -1.0f;
        for (int rx = 0; rx < width; rx++) {
            v128_t acc = wasm_f32x4_splat(0.0f);
            const v128_t x128 = wasm_f32x4_splat(x);
            for (int l = 0; l < simdLength; l++) {
                v128_t tmp = wasm_f32x4_sub(xArray128[l], x128);
                tmp = wasm_f32x4_mul(tmp, tmp);
                tmp = wasm_f32x4_add(tmp, dySquaredArray128[l]);
                tmp = wasm_f32x4_max(tmp, minDistanceSquared128);
                tmp = wasm_f32x4_div(qArray128[l], tmp);
                acc = wasm_f32x4_add(acc, tmp);
            }
            const float strength = k * (
                wasm_f32x4_extract_lane(acc, 0)
                + wasm_f32x4_extract_lane(acc, 1)
                + wasm_f32x4_extract_lane(acc, 2)
                + wasm_f32x4_extract_lane(acc, 3)
            );

            v128_t tmp = wasm_f32x4_mul(wasm_f32x4_splat(strength), wasm_f32x4_const(1.0f, -1.0f, 0.0f, 0.0f));
            tmp = wasm_f32x4_min(tmp, ffff128);
            tmp = wasm_f32x4_max(tmp, zero128);
            tmp = wasm_f32x4_sqrt(tmp);
            tmp = wasm_f32x4_add(tmp, wasm_f32x4_const(0.0f, 0.0f, 0.0f, 255.0f));
            tmp = wasm_i32x4_trunc_sat_f32x4(tmp);

            v128_t rgb = wasm_i8x16_splat((unsigned char)wasm_i32x4_extract_lane(tmp, 0));
            rgb = wasm_i8x16_replace_lane(rgb, 1, (unsigned char)wasm_i32x4_extract_lane(tmp, 1));
            rgb = wasm_i8x16_replace_lane(rgb, 2, (unsigned char)wasm_i32x4_extract_lane(tmp, 2));
            rgb = wasm_i8x16_replace_lane(rgb, 3, (unsigned char)wasm_i32x4_extract_lane(tmp, 3));
            scene[i++] = wasm_i32x4_extract_lane(rgb, 0);

            x += dx;
        }

        y -= dy;
    }

    if (grid > 0.0f) {
        float x = -1.0f;
        for (int i = 0; i < width; i++, x += dx) {
            const float diff = nearbyintf(x / grid) * grid - x;
            if (diff <= dx && diff >= -dx) {
                for (int j = 0, l = i; j < height; j++, l+=width) {
                    scene[l] = 0xa0a0a0a0;
                }
            }
        }

        float y = 1.0f;
        for (int i = 0; i < height; i++, y -= dy) {
            const float diff = nearbyintf(y / grid) * grid - y;
            if (diff <= dy && diff >= -dy) {
                for (int j = 0, l = i*width; j < width; j++) {
                    scene[l++] = 0xa0a0a0a0;
                }
            }
        }
    }
}
