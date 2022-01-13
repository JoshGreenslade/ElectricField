

/*
  apt install clang wabt lld binaryen

  clang --target=wasm32 --optimize=4 -nostdlib \
    -Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined -Wall \
    --output renderer.wasm renderer.c
*/


// Clang will use f32.nearest for this.
extern float rintf(float);


#define k 0.001f
#define smallestPassingDistanceSquared 0.000003f


extern void renderScene(const int width, const int height, const int length, const float grid, unsigned char* buffer)
{
    float* qArray = (float*)(buffer + width * height * sizeof(unsigned int));
    float* xArray = qArray + length;
    float* yArray = xArray + length;
    float* dySquaredArray = yArray + length;
    unsigned char* xGridPoints = (unsigned char*)(dySquaredArray + length);
    unsigned char* yGridPoints = xGridPoints + width;

    // TODO sanity checks on size.
    const float dy = 2.0f / (height - 1);
    const float dx = 2.0f / (width - 1);

    float x = -1.0f;
    for (int i = 0; i < width; i++) {
        if (grid > 0.0f) {
            const float diff = rintf(x / grid) * grid - x;
            xGridPoints[i] = (diff < dx && diff > -dx) ? 1 : 0;
        } else {
            xGridPoints[i] = 0;
        }
        x += dx;
    }

    float y = 1.0f;
    for (int i = 0; i < height; i++) {
        if (grid > 0) {
            const float diff = rintf(y / grid) * grid - y;
            yGridPoints[i] = (diff < dy && diff > -dy) ? 1 : 0;
        } else {
            yGridPoints[i] = 0;
        }
        y -= dy;
    }

    y = 1.0f;
    for (int ry = 0, i = 0; ry < height; ry++) {

        const int yGrid = yGridPoints[ry] != 0;

        for (int j = 0; j < length; j++) {
            const float tmp = y - yArray[j];
            dySquaredArray[j] = tmp * tmp;
        }

        x = -1.0f;
        for (int rx = 0; rx < width; rx++) {

            if (yGrid && xGridPoints[rx] != 0) {
                buffer[i + 0] = 255;
                buffer[i + 1] = 255;
                buffer[i + 2] = 255;
                buffer[i + 3] = 255;
            } else {
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
            }

            i += 4;
            x += dx;
        }

        y -= dy;
    }

    qArray[0] = 1.23f;
    xArray[0] = 2.34f;
    yArray[0] = 3.45f;
}
