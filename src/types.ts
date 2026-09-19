export type PipelineStep =
  | "upload"
  | "detect"
  | "opencv"
  | "mask"
  | "inpaint"
  | "export";

export interface WatermarkBox {
  id: string;
  ymin: number; // 0 to 1
  xmin: number; // 0 to 1
  ymax: number; // 0 to 1
  xmax: number; // 0 to 1
  label: string;
  confidence?: number;
  type?: "text" | "logo" | "pattern" | "stamp" | "custom";
}

export type MaskThresholdMode = "otsu" | "adaptive" | "color_diff" | "luminance" | "fill";

export interface MaskConfig {
  thresholdMode: MaskThresholdMode;
  sensitivity: number; // 0 to 100
  dilationRadius: number; // 0 to 15 pixels
  invertMask: boolean;
  edgeBlur: number; // 0 to 5 pixels
}

export interface InpaintConfig {
  algorithm: "telea" | "ns";
  radius: number; // 1 to 20
  passes: number; // 1 to 3
}

export interface LogoOverlayConfig {
  enabled: boolean;
  opacity: number; // 0 to 1 (default 0.5 = 50%)
  sizeScale: number; // 0.2 to 1.5 relative to removed watermark zone
  color: string;
}

export interface PipelineMetrics {
  detectionTimeMs?: number;
  maskGenTimeMs?: number;
  inpaintTimeMs?: number;
  totalTimeMs?: number;
  engineUsed: "opencv-wasm" | "telea-fast-marching";
  pixelsInpainted?: number;
  originalSize?: { width: number; height: number };
}

export interface SampleImageItem {
  id: string;
  name: string;
  category: string;
  description: string;
  watermarkDescription: string;
  generator: () => Promise<string>;
}
