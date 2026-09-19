import { MaskConfig, WatermarkBox } from "../types";
import { openCVLoader } from "./opencvLoader";

/**
 * Generates a precise binary mask canvas (white = inpaint, black = preserve)
 * from an image canvas and a list of watermark bounding boxes.
 */
export function generatePreciseMask(
  sourceCanvas: HTMLCanvasElement,
  boxes: WatermarkBox[],
  config: MaskConfig
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })!;

  // Fill black (preserve all by default)
  maskCtx.fillStyle = "#000000";
  maskCtx.fillRect(0, 0, width, height);

  if (boxes.length === 0) {
    return maskCanvas;
  }

  // Check if OpenCV is available
  if (openCVLoader.isReady()) {
    try {
      const cv = window.cv;
      const srcMat = cv.imread(sourceCanvas);
      const maskMat = new cv.Mat.zeros(height, width, cv.CV_8UC1);

      for (const box of boxes) {
        const x = Math.max(0, Math.floor(box.xmin * width));
        const y = Math.max(0, Math.floor(box.ymin * height));
        const w = Math.min(width - x, Math.ceil((box.xmax - box.xmin) * width));
        const h = Math.min(height - y, Math.ceil((box.ymax - box.ymin) * height));

        if (w <= 0 || h <= 0) continue;

        if (config.thresholdMode === "fill") {
          // Fill the entire bounding rectangle
          const rect = new cv.Rect(x, y, w, h);
          const roiMask = maskMat.roi(rect);
          roiMask.setTo(new cv.Scalar(255));
          roiMask.delete();
          continue;
        }

        // Extract ROI for precise text/watermark edge masking
        const rect = new cv.Rect(x, y, w, h);
        const roi = srcMat.roi(rect);
        const grayRoi = new cv.Mat();
        const threshRoi = new cv.Mat();

        cv.cvtColor(roi, grayRoi, cv.COLOR_RGBA2GRAY, 0);

        if (config.thresholdMode === "otsu") {
          // Otsu's thresholding automatically calculates the optimum threshold limit
          cv.threshold(grayRoi, threshRoi, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
        } else if (config.thresholdMode === "adaptive") {
          cv.adaptiveThreshold(
            grayRoi,
            threshRoi,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            11,
            2
          );
        } else {
          // Luminance / sensitivity based
          const threshVal = Math.round((config.sensitivity / 100) * 255);
          cv.threshold(grayRoi, threshRoi, threshVal, 255, cv.THRESH_BINARY);
        }

        // Check if inverted needed
        if (config.invertMask) {
          cv.bitwise_not(threshRoi, threshRoi);
        }

        // Apply morphological dilation to cover anti-aliased font edges
        if (config.dilationRadius > 0) {
          const kSize = config.dilationRadius * 2 + 1;
          const kernel = cv.getStructuringElement(
            cv.MORPH_ELLIPSE,
            new cv.Size(kSize, kSize)
          );
          cv.dilate(threshRoi, threshRoi, kernel);
          kernel.delete();
        }

        // Copy back to maskMat ROI
        const destRoi = maskMat.roi(rect);
        cv.bitwise_or(destRoi, threshRoi, destRoi);

        destRoi.delete();
        roi.delete();
        grayRoi.delete();
        threshRoi.delete();
      }

      // Render maskMat onto maskCanvas
      cv.imshow(maskCanvas, maskMat);

      srcMat.delete();
      maskMat.delete();

      return maskCanvas;
    } catch (err) {
      console.warn("OpenCV mask generation failed; falling back to canvas pixel method:", err);
    }
  }

  // Pure Canvas / Pixel-based precise mask generation fallback
  const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true })!;
  const srcData = srcCtx.getImageData(0, 0, width, height);
  const srcPixels = srcData.data;

  const maskData = maskCtx.getImageData(0, 0, width, height);
  const maskPixels = maskData.data;

  for (const box of boxes) {
    const startX = Math.max(0, Math.floor(box.xmin * width));
    const startY = Math.max(0, Math.floor(box.ymin * height));
    const endX = Math.min(width, Math.ceil(box.xmax * width));
    const endY = Math.min(height, Math.ceil(box.ymax * height));

    if (config.thresholdMode === "fill") {
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          maskPixels[idx] = 255;
          maskPixels[idx + 1] = 255;
          maskPixels[idx + 2] = 255;
          maskPixels[idx + 3] = 255;
        }
      }
      continue;
    }

    // Compute mean luminance of the box to detect text contrast
    let sumLum = 0;
    let count = 0;
    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * srcPixels[idx] + 0.587 * srcPixels[idx + 1] + 0.114 * srcPixels[idx + 2];
        sumLum += lum;
        count++;
      }
    }
    const meanLum = count > 0 ? sumLum / count : 128;
    const thresholdDelta = 25 + (100 - config.sensitivity) * 0.4;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * srcPixels[idx] + 0.587 * srcPixels[idx + 1] + 0.114 * srcPixels[idx + 2];

        // Is pixel significantly different from local background? (indicates watermark text/overlay)
        let isWatermark = Math.abs(lum - meanLum) > thresholdDelta;
        if (config.invertMask) isWatermark = !isWatermark;

        if (isWatermark) {
          maskPixels[idx] = 255;
          maskPixels[idx + 1] = 255;
          maskPixels[idx + 2] = 255;
          maskPixels[idx + 3] = 255;
        }
      }
    }
  }

  // Morphological dilation on the mask in JS if dilationRadius > 0
  if (config.dilationRadius > 0) {
    const d = config.dilationRadius;
    const dilated = new Uint8ClampedArray(maskPixels.length);
    dilated.set(maskPixels);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pIdx = (y * width + x) * 4;
        if (maskPixels[pIdx] === 255) {
          // Dilate circle
          for (let dy = -d; dy <= d; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -d; dx <= d; dx++) {
              if (dx * dx + dy * dy <= d * d) {
                const nx = x + dx;
                if (nx < 0 || nx >= width) continue;
                const nIdx = (ny * width + nx) * 4;
                dilated[nIdx] = 255;
                dilated[nIdx + 1] = 255;
                dilated[nIdx + 2] = 255;
                dilated[nIdx + 3] = 255;
              }
            }
          }
        }
      }
    }
    maskData.data.set(dilated);
  }

  maskCtx.putImageData(maskData, 0, 0);
  return maskCanvas;
}
