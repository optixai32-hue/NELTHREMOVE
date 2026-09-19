/**
 * Utilities for stamping the replacement logo over the inpainted watermark region
 */
import { WatermarkBox, LogoOverlayConfig } from "../types";

export const CUSTOM_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 497 502"
     width="497"
     height="502">
  <style>
    .logo {
      color: #ffffff;
      fill: currentColor;
      stroke: currentColor;
      stroke-width: 7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  </style>
  <path
    class="logo"
    d="M380 85.5c-.8.7-6.9 5.3-13.5 10-33.7 24.3-107.8 79.8-108.2 81.1-.4 1.1 14.6 9.6 47.7 27.1l18.5 9.8.3 40.5c.1 22.2-.1 40.7-.6 41.2-.4.4-6.6-2.8-13.7-7.1-39.9-24-52.5-31.2-53.5-30.6-.6.4-1 11.8-1 33.4 0 32.7 0 32.8 2.3 34.8 2.5 2.4 6.9 5.1 21.7 13.8 5.8 3.4 17.6 10.5 26.3 15.8 19.9 12.2 23.9 14.3 31.5 15.8 14.7 3.1 33-5.4 40.9-18.8 5.5-9.4 5.3-4.5 5.3-141.6 0-132.7.1-129.4-4-125.2m-225.9 45c-12.4 3.5-20.9 10.6-26.4 22.3l-3.2 6.7-.1 128.8c-.2 113.3 0 128.8 1.3 128.3 1.8-.7 16.9-11.6 33.6-24.1 6.5-5 21.7-16.1 33.6-24.8 40.9-29.8 57.1-41.9 57.1-42.8 0-1.4-5.4-4.5-34.5-19.9-14.8-7.9-28-14.9-29.1-15.6-2-1.2-2.2-2.3-2.9-27.3-.8-29.7.1-56.1 1.9-56.1.7 0 4.5 2.1 8.6 4.7 19.8 12.5 56.6 34.1 57.2 33.7.5-.3.8-15.5.8-33.9v-33.3l-3-2.6c-4.7-3.9-66.6-40.6-72-42.7-6.9-2.6-16.4-3.2-22.9-1.4"/>
</svg>`;

export type LogoOverlaySettings = LogoOverlayConfig;

export const DEFAULT_LOGO_SETTINGS: LogoOverlayConfig = {
  enabled: true,
  opacity: 0.40, // 40% opacity as requested
  sizeScale: 1.00, // 100% size scale as requested
  color: "#ffffff",
};

let cachedLogoImage: HTMLImageElement | null = null;
let cachedLogoPromise: Promise<HTMLImageElement> | null = null;

export function loadLogoImage(): Promise<HTMLImageElement> {
  if (cachedLogoImage) return Promise.resolve(cachedLogoImage);
  if (cachedLogoPromise) return cachedLogoPromise;

  cachedLogoPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const svgBlob = new Blob([CUSTOM_LOGO_SVG], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cachedLogoImage = img;
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });

  return cachedLogoPromise;
}

/**
 * Creates a new canvas from the inpainted canvas with the custom logo drawn
 * centered inside the removed watermark bounding box with 50% opacity and compact sizing.
 */
export async function applyLogoOverlay(
  inpaintedCanvas: HTMLCanvasElement,
  boxes: WatermarkBox[],
  settings: LogoOverlaySettings = DEFAULT_LOGO_SETTINGS
): Promise<HTMLCanvasElement> {
  const outCanvas = document.createElement("canvas");
  outCanvas.width = inpaintedCanvas.width;
  outCanvas.height = inpaintedCanvas.height;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) return inpaintedCanvas;

  // 1. Draw the clean inpainted background
  ctx.drawImage(inpaintedCanvas, 0, 0);

  if (!settings.enabled || boxes.length === 0) {
    return outCanvas;
  }

  const logoImg = await loadLogoImage();

  // Draw logo in each watermark box (typically the bottom-right zone)
  for (const box of boxes) {
    const boxX = box.xmin * outCanvas.width;
    const boxY = box.ymin * outCanvas.height;
    const boxW = (box.xmax - box.xmin) * outCanvas.width;
    const boxH = (box.ymax - box.ymin) * outCanvas.height;

    // Calculate compact logo dimensions preserving 497:502 aspect ratio (~1:1)
    const logoAspect = 497 / 502;
    // Fit into box with requested size scale, ensuring healthy minimum size
    const baseDimension = Math.max(boxH * 1.3, Math.min(boxW * 0.45, boxH * 2.2));
    const targetH = Math.max(26, outCanvas.height * 0.032, baseDimension * settings.sizeScale);
    const targetW = targetH * logoAspect;

    // Center logo horizontally and vertically in the removed watermark zone
    const drawX = boxX + (boxW - targetW) / 2;
    const drawY = boxY + (boxH - targetH) / 2;

    ctx.save();
    ctx.globalAlpha = settings.opacity; // 50% opacity
    ctx.drawImage(logoImg, drawX, drawY, targetW, targetH);
    ctx.restore();
  }

  return outCanvas;
}
