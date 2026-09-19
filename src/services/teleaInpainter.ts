import { openCVLoader } from "./opencvLoader";

export interface InpaintResult {
  imageData: ImageData;
  engineUsed: "opencv-wasm" | "telea-fast-marching";
  durationMs: number;
  pixelsInpainted: number;
}

/**
 * Executes Telea inpainting using either OpenCV.js WASM or native Fast Marching Method.
 */
export async function runTeleaInpaint(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  radius: number = 5,
  algorithm: "telea" | "ns" = "telea"
): Promise<InpaintResult> {
  const startTime = performance.now();
  const width = imageCanvas.width;
  const height = imageCanvas.height;

  // Try OpenCV.js if ready
  if (openCVLoader.isReady()) {
    try {
      const cv = window.cv;
      const src = cv.imread(imageCanvas);
      const maskSrc = cv.imread(maskCanvas);
      const maskGray = new cv.Mat();
      const dst = new cv.Mat();

      // Convert mask to single channel 8-bit
      cv.cvtColor(maskSrc, maskGray, cv.COLOR_RGBA2GRAY, 0);

      // Inpaint flag
      const flag = algorithm === "ns" ? cv.INPAINT_NS : cv.INPAINT_TELEA;

      // Count masked pixels
      const nonZero = cv.countNonZero(maskGray);

      // Perform inpaint
      cv.inpaint(src, maskGray, dst, Math.max(1, Math.round(radius)), flag);

      // Draw output to temporary canvas to retrieve ImageData
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      cv.imshow(tempCanvas, dst);

      const tempCtx = tempCanvas.getContext("2d");
      const resultImageData = tempCtx!.getImageData(0, 0, width, height);

      // Cleanup OpenCV memory
      src.delete();
      maskSrc.delete();
      maskGray.delete();
      dst.delete();

      const durationMs = Math.round(performance.now() - startTime);
      return {
        imageData: resultImageData,
        engineUsed: "opencv-wasm",
        durationMs,
        pixelsInpainted: nonZero,
      };
    } catch (err) {
      console.warn("OpenCV inpainting threw exception; falling back to native Fast Marching Telea:", err);
    }
  }

  // Pure TypeScript/JS Fast Marching Telea Inpainter
  return runNativeTeleaInpaint(imageCanvas, maskCanvas, radius);
}

/**
 * Native Fast Marching Method (FMM) Telea Inpainting algorithm
 * Based on Alexandru Telea, "An Image Inpainting Technique Based on the Fast Marching Method", 2004.
 */
function runNativeTeleaInpaint(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  radius: number = 5
): InpaintResult {
  const startTime = performance.now();
  const width = imageCanvas.width;
  const height = imageCanvas.height;

  const imgCtx = imageCanvas.getContext("2d", { willReadFrequently: true })!;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })!;

  const imgData = imgCtx.getImageData(0, 0, width, height);
  const maskData = maskCtx.getImageData(0, 0, width, height);

  const pixels = imgData.data;
  const mask = maskData.data;

  const totalPixels = width * height;
  const FLAG_KNOWN = 0;
  const FLAG_BAND = 1;
  const FLAG_INSIDE = 2;

  const flags = new Uint8Array(totalPixels);
  const T = new Float32Array(totalPixels); // Distance function (Eikonal)

  let maskedCount = 0;

  // Initialize flags and distance map
  for (let i = 0; i < totalPixels; i++) {
    // Masked pixel if red channel > 128 or alpha > 128
    const maskVal = mask[i * 4];
    if (maskVal > 64) {
      flags[i] = FLAG_INSIDE;
      T[i] = 1.0e6;
      maskedCount++;
    } else {
      flags[i] = FLAG_KNOWN;
      T[i] = 0;
    }
  }

  if (maskedCount === 0) {
    return {
      imageData: imgData,
      engineUsed: "telea-fast-marching",
      durationMs: Math.round(performance.now() - startTime),
      pixelsInpainted: 0,
    };
  }

  // Priority Queue for Fast Marching Band
  class MinHeap {
    private nodes: number[] = [];

    push(index: number) {
      this.nodes.push(index);
      this.up(this.nodes.length - 1);
    }

    pop(): number | undefined {
      if (this.nodes.length === 0) return undefined;
      const top = this.nodes[0];
      const bottom = this.nodes.pop()!;
      if (this.nodes.length > 0) {
        this.nodes[0] = bottom;
        this.down(0);
      }
      return top;
    }

    get size(): number {
      return this.nodes.length;
    }

    private up(i: number) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (T[this.nodes[i]] < T[this.nodes[p]]) {
          const tmp = this.nodes[i];
          this.nodes[i] = this.nodes[p];
          this.nodes[p] = tmp;
          i = p;
        } else break;
      }
    }

    private down(i: number) {
      const len = this.nodes.length;
      while ((i << 1) + 1 < len) {
        let left = (i << 1) + 1;
        let right = left + 1;
        let best = i;

        if (T[this.nodes[left]] < T[this.nodes[best]]) best = left;
        if (right < len && T[this.nodes[right]] < T[this.nodes[best]]) best = right;

        if (best !== i) {
          const tmp = this.nodes[i];
          this.nodes[i] = this.nodes[best];
          this.nodes[best] = tmp;
          i = best;
        } else break;
      }
    }
  }

  const bandHeap = new MinHeap();

  // Find initial narrow band (INSIDE pixels neighboring KNOWN pixels)
  const neighbors = [-1, 1, -width, width];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (flags[idx] === FLAG_INSIDE) {
        let isBoundary = false;
        // Check 4-connected neighbors
        if (x > 0 && flags[idx - 1] === FLAG_KNOWN) isBoundary = true;
        else if (x < width - 1 && flags[idx + 1] === FLAG_KNOWN) isBoundary = true;
        else if (y > 0 && flags[idx - width] === FLAG_KNOWN) isBoundary = true;
        else if (y < height - 1 && flags[idx + width] === FLAG_KNOWN) isBoundary = true;

        if (isBoundary) {
          flags[idx] = FLAG_BAND;
          T[idx] = 1.0;
          bandHeap.push(idx);
        }
      }
    }
  }

  const inpaintRadius = Math.max(2, Math.min(15, Math.round(radius)));
  const inpaintRadiusSq = inpaintRadius * inpaintRadius;

  // March along the narrow band
  while (bandHeap.size > 0) {
    const pIdx = bandHeap.pop()!;
    flags[pIdx] = FLAG_KNOWN;

    const px = pIdx % width;
    const py = Math.floor(pIdx / width);

    // Estimate gradient at p from known neighbors for directional isophote alignment
    let gradTx = 0;
    let gradTy = 0;
    if (px > 0 && px < width - 1) {
      if (flags[pIdx + 1] === FLAG_KNOWN && flags[pIdx - 1] === FLAG_KNOWN) {
        gradTx = (T[pIdx + 1] - T[pIdx - 1]) * 0.5;
      } else if (flags[pIdx + 1] === FLAG_KNOWN) {
        gradTx = T[pIdx + 1] - T[pIdx];
      } else if (flags[pIdx - 1] === FLAG_KNOWN) {
        gradTx = T[pIdx] - T[pIdx - 1];
      }
    }
    if (py > 0 && py < height - 1) {
      if (flags[pIdx + width] === FLAG_KNOWN && flags[pIdx - width] === FLAG_KNOWN) {
        gradTy = (T[pIdx + width] - T[pIdx - width]) * 0.5;
      } else if (flags[pIdx + width] === FLAG_KNOWN) {
        gradTy = T[pIdx + width] - T[pIdx];
      } else if (flags[pIdx - width] === FLAG_KNOWN) {
        gradTy = T[pIdx] - T[pIdx - width];
      }
    }

    const gradLen = Math.sqrt(gradTx * gradTx + gradTy * gradTy);
    let nx = 0;
    let ny = 0;
    if (gradLen > 1e-4) {
      nx = gradTx / gradLen;
      ny = gradTy / gradLen;
    }

    // Telea neighborhood weighting
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumWeight = 0;

    const yMin = Math.max(0, py - inpaintRadius);
    const yMax = Math.min(height - 1, py + inpaintRadius);
    const xMin = Math.max(0, px - inpaintRadius);
    const xMax = Math.min(width - 1, px + inpaintRadius);

    for (let qy = yMin; qy <= yMax; qy++) {
      for (let qx = xMin; qx <= xMax; qx++) {
        const qIdx = qy * width + qx;
        if (flags[qIdx] === FLAG_KNOWN) {
          const dx = px - qx;
          const dy = py - qy;
          const distSq = dx * dx + dy * dy;

          if (distSq <= inpaintRadiusSq && distSq > 0) {
            const dist = Math.sqrt(distSq);

            // Directional weight (projection along normal / isophotes)
            let dir = Math.abs(dx * nx + dy * ny) / dist;
            if (dir < 0.001) dir = 0.001;

            // Geometric distance weight
            const dst = 1.0 / (dist * dist);

            // Level set weight
            const lev = 1.0 / (1.0 + Math.abs(T[pIdx] - T[qIdx]));

            const w = dir * dst * lev;

            const qOffset = qIdx * 4;
            sumR += pixels[qOffset] * w;
            sumG += pixels[qOffset + 1] * w;
            sumB += pixels[qOffset + 2] * w;
            sumWeight += w;
          }
        }
      }
    }

    if (sumWeight > 0) {
      const pOffset = pIdx * 4;
      pixels[pOffset] = Math.round(sumR / sumWeight);
      pixels[pOffset + 1] = Math.round(sumG / sumWeight);
      pixels[pOffset + 2] = Math.round(sumB / sumWeight);
      pixels[pOffset + 3] = 255;
    }

    // Propagate into INSIDE neighbors
    for (const offset of neighbors) {
      const nIdx = pIdx + offset;
      if (nIdx >= 0 && nIdx < totalPixels) {
        if (flags[nIdx] === FLAG_INSIDE) {
          flags[nIdx] = FLAG_BAND;
          T[nIdx] = T[pIdx] + 1.0;
          bandHeap.push(nIdx);
        }
      }
    }
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    imageData: imgData,
    engineUsed: "telea-fast-marching",
    durationMs,
    pixelsInpainted: maskedCount,
  };
}
