import { WatermarkBox } from "../types";

export interface DetectionResult {
  watermarks: WatermarkBox[];
  source: "nvidia-nemotron" | "gemini-3.8-flash" | "heuristic" | "fallback";
  durationMs: number;
  message?: string;
  reasoningContent?: string;
}

/**
 * Calls backend API to detect watermarks using Gemini 3.8 Flash,
 * with fallback to local heuristic CV if offline or API key absent.
 */
export async function detectWatermarks(
  canvas: HTMLCanvasElement
): Promise<DetectionResult> {
  const startTime = performance.now();

  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    const response = await fetch("/api/detect-watermark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType: "image/jpeg",
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const json = await response.json();
    const durationMs = Math.round(performance.now() - startTime);

    if (json.watermarks && Array.isArray(json.watermarks) && json.watermarks.length > 0) {
      return {
        watermarks: json.watermarks.map((w: any, idx: number) => ({
          id: w.id || `wm-${idx + 1}`,
          ymin: w.box ? w.box.ymin : w.ymin,
          xmin: w.box ? w.box.xmin : w.xmin,
          ymax: w.box ? w.box.ymax : w.ymax,
          xmax: w.box ? w.box.xmax : w.xmax,
          label: w.label || "Detected Watermark",
          confidence: w.confidence || 0.9,
          type: w.type || "text",
        })),
        source: json.source || "gemini-3.8-flash",
        durationMs,
        message: json.message,
      };
    }
  } catch (err) {
    console.warn("Detection API error, switching to client-side heuristic:", err);
  }

  // Client-side heuristic watermark detection
  const durationMs = Math.round(performance.now() - startTime);
  const heuristicWatermarks = detectHeuristicWatermarks(canvas);

  return {
    watermarks: heuristicWatermarks,
    source: "heuristic",
    durationMs,
    message: "Detected using local computer vision heuristic.",
  };
}

/**
 * Heuristic detector analyzing high-frequency contrast in standard corner zones.
 */
export function detectHeuristicWatermarks(canvas: HTMLCanvasElement): WatermarkBox[] {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return [getPresetBox("bottom-right")];
  }

  // Check 4 corners for high frequency text edges
  const zones: { name: string; box: WatermarkBox }[] = [
    { name: "bottom-right", box: getPresetBox("bottom-right") },
    { name: "bottom-left", box: getPresetBox("bottom-left") },
    { name: "top-right", box: getPresetBox("top-right") },
    { name: "center", box: getPresetBox("center") },
  ];

  let bestZone = zones[0].box;
  let maxVariance = -1;

  for (const z of zones) {
    const x = Math.floor(z.box.xmin * width);
    const y = Math.floor(z.box.ymin * height);
    const w = Math.floor((z.box.xmax - z.box.xmin) * width);
    const h = Math.floor((z.box.ymax - z.box.ymin) * height);

    if (w <= 0 || h <= 0) continue;

    try {
      const data = ctx.getImageData(x, y, w, h).data;
      let sum = 0;
      let sumSq = 0;
      const count = (w * h) / 4;

      for (let i = 0; i < data.length; i += 16) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += lum;
        sumSq += lum * lum;
      }

      const mean = sum / count;
      const variance = sumSq / count - mean * mean;

      if (variance > maxVariance) {
        maxVariance = variance;
        bestZone = { ...z.box, confidence: Math.min(0.95, 0.65 + variance / 2000) };
      }
    } catch {
      // Continue
    }
  }

  return [bestZone];
}

export function shrinkBox(box: WatermarkBox, factor: number = 0.15): WatermarkBox {
  const w = box.xmax - box.xmin;
  const h = box.ymax - box.ymin;
  const deltaW = w * factor;
  const deltaH = h * factor;

  let newXmin = box.xmin;
  let newXmax = box.xmax;
  let newYmin = box.ymin;
  let newYmax = box.ymax;

  // Corner-aware horizontal shrinking
  if (box.xmax >= 0.94 && box.xmin > 0.4) {
    // Anchored to right: shrink from left side
    newXmin = Math.min(box.xmax - 0.04, box.xmin + deltaW);
  } else if (box.xmin <= 0.06 && box.xmax < 0.6) {
    // Anchored to left: shrink from right side
    newXmax = Math.max(box.xmin + 0.04, box.xmax - deltaW);
  } else {
    // Centered or arbitrary: shrink symmetrically
    newXmin = Math.max(0, box.xmin + deltaW / 2);
    newXmax = Math.min(1, box.xmax - deltaW / 2);
  }

  // Corner-aware vertical shrinking
  if (box.ymax >= 0.94 && box.ymin > 0.4) {
    // Anchored to bottom: shrink from top side
    newYmin = Math.min(box.ymax - 0.03, box.ymin + deltaH);
  } else if (box.ymin <= 0.06 && box.ymax < 0.6) {
    // Anchored to top: shrink from bottom side
    newYmax = Math.max(box.ymin + 0.03, box.ymax - deltaH);
  } else {
    // Centered: shrink symmetrically
    newYmin = Math.max(0, box.ymin + deltaH / 2);
    newYmax = Math.min(1, box.ymax - deltaH / 2);
  }

  return {
    ...box,
    xmin: Number(Math.max(0, newXmin).toFixed(3)),
    xmax: Number(Math.min(1, newXmax).toFixed(3)),
    ymin: Number(Math.max(0, newYmin).toFixed(3)),
    ymax: Number(Math.min(1, newYmax).toFixed(3)),
  };
}

export function expandBox(box: WatermarkBox, factor: number = 0.15): WatermarkBox {
  const w = box.xmax - box.xmin;
  const h = box.ymax - box.ymin;
  const deltaW = w * factor;
  const deltaH = h * factor;

  let newXmin = box.xmin;
  let newXmax = box.xmax;
  let newYmin = box.ymin;
  let newYmax = box.ymax;

  if (box.xmax >= 0.94 && box.xmin > 0.4) {
    newXmin = Math.max(0, box.xmin - deltaW);
  } else if (box.xmin <= 0.06 && box.xmax < 0.6) {
    newXmax = Math.min(1, box.xmax + deltaW);
  } else {
    newXmin = Math.max(0, box.xmin - deltaW / 2);
    newXmax = Math.min(1, box.xmax + deltaW / 2);
  }

  if (box.ymax >= 0.94 && box.ymin > 0.4) {
    newYmin = Math.max(0, box.ymin - deltaH);
  } else if (box.ymin <= 0.06 && box.ymax < 0.6) {
    newYmax = Math.min(1, box.ymax + deltaH);
  } else {
    newYmin = Math.max(0, box.ymin - deltaH / 2);
    newYmax = Math.min(1, box.ymax + deltaH / 2);
  }

  return {
    ...box,
    xmin: Number(Math.max(0, newXmin).toFixed(3)),
    xmax: Number(Math.min(1, newXmax).toFixed(3)),
    ymin: Number(Math.max(0, newYmin).toFixed(3)),
    ymax: Number(Math.min(1, newYmax).toFixed(3)),
  };
}

export type AspectRatioType = "1:1" | "16:9" | "9:16";

export type PresetZoneType =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "center"
  | "bottom-banner"
  | "bottom-right-1-1"
  | "bottom-right-16-9"
  | "bottom-right-9-16";

export function getWatermarkBoxForRatio(ratio: AspectRatioType): WatermarkBox {
  const id = `preset-ratio-${ratio}-${Date.now()}`;
  switch (ratio) {
    case "1:1":
      // Rectangle compact 10% x 4% pour carré 1:1
      return {
        id,
        xmin: 0.87,
        ymin: 0.94,
        xmax: 0.97,
        ymax: 0.98,
        label: "Bottom-Right Watermark (1:1)",
        confidence: 0.92,
        type: "text",
      };
    case "16:9":
      // Rectangle compact adapté pour paysage 16:9 : 10% x 6% (X: 87%-97%, Y: 90%-96%)
      return {
        id,
        xmin: 0.87,
        ymin: 0.90,
        xmax: 0.97,
        ymax: 0.96,
        label: "Bottom-Right Watermark (16:9)",
        confidence: 0.92,
        type: "text",
      };
    case "9:16":
      // Rectangle compact adapté pour portrait vertical 9:16 : 12% x 2% (X: 86%-98%, Y: 97%-99%)
      return {
        id,
        xmin: 0.86,
        ymin: 0.97,
        xmax: 0.98,
        ymax: 0.99,
        label: "Bottom-Right Watermark (9:16)",
        confidence: 0.92,
        type: "text",
      };
  }
}

export function getPresetBox(preset: PresetZoneType): WatermarkBox {
  const id = `preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  switch (preset) {
    case "bottom-right-1-1":
      return getWatermarkBoxForRatio("1:1");
    case "bottom-right-16-9":
      return getWatermarkBoxForRatio("16:9");
    case "bottom-right-9-16":
      return getWatermarkBoxForRatio("9:16");
    case "bottom-right":
      return {
        id,
        xmin: 0.87,
        ymin: 0.94,
        xmax: 0.97,
        ymax: 0.98,
        label: "Bottom-Right Watermark",
        confidence: 0.9,
        type: "text",
      };
    case "bottom-left":
      return {
        id,
        xmin: 0.02,
        ymin: 0.89,
        xmax: 0.24,
        ymax: 0.98,
        label: "Bottom-Left Watermark",
        confidence: 0.88,
        type: "logo",
      };
    case "top-right":
      return {
        id,
        xmin: 0.76,
        ymin: 0.02,
        xmax: 0.98,
        ymax: 0.11,
        label: "Top-Right Stamp",
        confidence: 0.87,
        type: "stamp",
      };
    case "top-left":
      return {
        id,
        xmin: 0.02,
        ymin: 0.02,
        xmax: 0.24,
        ymax: 0.11,
        label: "Top-Left Logo",
        confidence: 0.86,
        type: "logo",
      };
    case "center":
      return {
        id,
        xmin: 0.30,
        ymin: 0.44,
        xmax: 0.70,
        ymax: 0.56,
        label: "Center Watermark Banner",
        confidence: 0.92,
        type: "text",
      };
    case "bottom-banner":
      return {
        id,
        xmin: 0.06,
        ymin: 0.92,
        xmax: 0.94,
        ymax: 0.98,
        label: "Bottom Footer Banner",
        confidence: 0.9,
        type: "text",
      };
  }
}
