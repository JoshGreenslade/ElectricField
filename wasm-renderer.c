

/*
  apt install clang wabt lld binaryen

  clang --target=wasm32 --optimize=4 -nostdlib \
    -Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined -Wall \
    --output wasm-renderer.wasm wasm-renderer.c
*/


#define k 0.001f
#define smallestPassingDistanceSquared 0.00003f


void renderScene(
    const int width,
    const int height,
    unsigned char* buffer,
    const int length,
    const float* qArray,
    const float* xArray,
    const float* yArray,
    float* dySquaredArray
) {
    // TODO sanity checks on size.
    const float dy = -2.0f / (height - 1);
    const float dx = 2.0f / (width - 1);

    int i = 0;
    float y = 1.0f;
    for (int ry = 0; ry < height; ry++) {

        for (int j = 0; j < length; j++) {
            const float tmp = y - yArray[j];
            dySquaredArray[j] = tmp * tmp;
        }

        float x = -1.0f;
        for (int rx = 0; rx < width; rx++) {

            float strength = 0.0f;
            for (int l = 0; l < length; l++) {
                const float r = x - xArray[l];
                const float r2 = r * r + dySquaredArray[l];
                if (r2 > smallestPassingDistanceSquared) {
                    strength += k * qArray[l] / r2;
                } else {
                    strength += k * qArray[l] / smallestPassingDistanceSquared;
                }
            }

            // Pixel color for the field strength.
            float red = strength;
            if (red > 255.0f) {
                red = 255.0f;
            } else if (red < 0.0f) {
                red = 0.0f;
            }

            float green = strength / 15;
            if (green < 0.0f) {
                if (green < -255.0f) {
                    green = 255.0f;
                } else {
                    green = -green;
                }
            } else {
                if (green > 255.0f) {
                    green = 255.0f;
                }
            }

            float blue = -strength;
            if (blue > 255.0f) {
                blue = 255.0f;
            } else if (blue < 0.0f) {
                blue = 0.0f;
            }

            buffer[i + 0] = (unsigned char)red;
            buffer[i + 1] = (unsigned char)green;
            buffer[i + 2] = (unsigned char)blue;
            buffer[i + 3] = 255; // Alpha

            i += 4;
            x += dx;
        }

        y += dy;
    }
}
