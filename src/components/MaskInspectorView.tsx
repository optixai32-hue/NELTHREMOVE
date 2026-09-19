import React, { useRef, useEffect, useState } from "react";
import { MaskConfig, MaskThresholdMode, WatermarkBox } from "../types";
import { generatePreciseMask } from "../services/maskGenerator";
import { openCVLoader } from "../services/opencvLoader";
import {
  Scissors,
  Sliders,
  Cpu,
  Layers,
  Eye,
  Paintbrush,
  Eraser,
  RotateCcw,
  ArrowRight,
  Maximize2,
} from "lucide-react";

interface MaskInspectorViewProps {
  sourceImage: HTMLImageElement;
  boxes: WatermarkBox[];
  maskConfig: MaskConfig;
  onChangeMaskConfig: (cfg: MaskConfig) => void;
  onMaskReady: (maskCanvas: HTMLCanvasElement) => void;
  onProceedToInpaint: () => void;
}

export const MaskInspectorView: React.FC<MaskInspectorViewProps> = ({
  sourceImage,
  boxes,
  maskConfig,
  onChangeMaskConfig,
  onMaskReady,
  onProceedToInpaint,
}) => {
  const [viewMode, setViewMode] = useState<"overlay" | "binary" | "side-by-side">("overlay");
  const [brushMode, setBrushMode] = useState<"none" | "add" | "erase">("none");
  const [brushSize, setBrushSize] = useState<number>(14);
  const [isBrushing, setIsBrushing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const internalMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate source canvas
  const getSourceCanvas = (): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = sourceImage.naturalWidth;
    c.height = sourceImage.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(sourceImage, 0, 0);
    return c;
  };

  // Recompute mask when config or boxes change
  useEffect(() => {
    const srcCanvas = getSourceCanvas();
    const mask = generatePreciseMask(srcCanvas, boxes, maskConfig);
    internalMaskCanvasRef.current = mask;
    onMaskReady(mask);
    renderPreview();
  }, [sourceImage, boxes, maskConfig]);

  const renderPreview = () => {
    const canvas = previewCanvasRef.current;
    const mask = internalMaskCanvasRef.current;
    if (!canvas || !mask) return;

    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (viewMode === "binary") {
      // Direct binary mask
      ctx.drawImage(mask, 0, 0);
    } else if (viewMode === "overlay") {
      // Draw original image
      ctx.drawImage(sourceImage, 0, 0);

      // Create neon red overlay for masked pixels
      const maskCtx = mask.getContext("2d")!;
      const maskData = maskCtx.getImageData(0, 0, mask.width, mask.height);
      const mPixels = maskData.data;

      const overlay = ctx.createImageData(canvas.width, canvas.height);
      const oPixels = overlay.data;

      for (let i = 0; i < mPixels.length; i += 4) {
        if (mPixels[i] > 64) {
          // Semi-transparent vibrant red/rose overlay
          oPixels[i] = 244; // R
          oPixels[i + 1] = 63; // G
          oPixels[i + 2] = 94; // B
          oPixels[i + 3] = 190; // Alpha
        }
      }

      // Draw overlay via temporary canvas to maintain blend
      const tempC = document.createElement("canvas");
      tempC.width = canvas.width;
      tempC.height = canvas.height;
      tempC.getContext("2d")!.putImageData(overlay, 0, 0);
      ctx.drawImage(tempC, 0, 0);
    } else if (viewMode === "side-by-side") {
      // Half image, half mask
      const halfW = Math.floor(canvas.width / 2);
      ctx.drawImage(sourceImage, 0, 0, halfW, canvas.height, 0, 0, halfW, canvas.height);
      ctx.drawImage(mask, halfW, 0, halfW, canvas.height, halfW, 0, halfW, canvas.height);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(halfW, 0);
      ctx.lineTo(halfW, canvas.height);
      ctx.stroke();
    }
  };

  useEffect(() => {
    renderPreview();
  }, [viewMode]);

  // Brush drawing on mask
  const handleBrush = (clientX: number, clientY: number) => {
    if (brushMode === "none" || !previewCanvasRef.current || !internalMaskCanvasRef.current) return;

    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const maskCtx = internalMaskCanvasRef.current.getContext("2d")!;
    maskCtx.fillStyle = brushMode === "add" ? "#ffffff" : "#000000";
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize * (scaleX || 1), 0, Math.PI * 2);
    maskCtx.fill();

    onMaskReady(internalMaskCanvasRef.current);
    renderPreview();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (brushMode !== "none") {
      setIsBrushing(true);
      handleBrush(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isBrushing) {
      handleBrush(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsBrushing(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              OpenCV.js Engine & Precise Mask Generation
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Extracts exact watermark strokes using Otsu/Adaptive thresholding and morphological dilation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-neutral-800 p-1 rounded-lg border border-neutral-700">
            <button
              onClick={() => setViewMode("overlay")}
              className={`px-2.5 py-1 text-xs font-mono rounded ${
                viewMode === "overlay"
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              Overlay
            </button>
            <button
              onClick={() => setViewMode("binary")}
              className={`px-2.5 py-1 text-xs font-mono rounded ${
                viewMode === "binary"
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              Binary Mask
            </button>
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`px-2.5 py-1 text-xs font-mono rounded ${
                viewMode === "side-by-side"
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              Split View
            </button>
          </div>

          <button
            id="btn-proceed-inpaint"
            onClick={onProceedToInpaint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-mono font-bold uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <span>Proceed to Inpainting Telea</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mask Canvas Display */}
        <div className="lg:col-span-2 flex flex-col items-center">
          <div
            ref={containerRef}
            id="mask-preview-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`relative select-none rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950 shadow-2xl max-w-full ${
              brushMode !== "none" ? "cursor-crosshair" : "cursor-default"
            }`}
            style={{ maxHeight: "560px" }}
          >
            <canvas
              ref={previewCanvasRef}
              className="max-h-[560px] object-contain block"
            />
          </div>

          <div className="flex items-center justify-between w-full mt-3 text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>Red highlighted pixels = Targeted for Telea Inpainting</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>{openCVLoader.isReady() ? "OpenCV.js CV_8UC1 Mat" : "Canvas Pixel Engine"}</span>
            </div>
          </div>
        </div>

        {/* Mask Settings Sidebar */}
        <div className="space-y-4">
          {/* Threshold Mode */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Mask Extraction Algorithm</span>
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "otsu", label: "Otsu Automatic", desc: "Best for text watermarks" },
                { id: "adaptive", label: "Adaptive Gaussian", desc: "Uneven lighting/gradients" },
                { id: "luminance", label: "Luminance Delta", desc: "Manual threshold" },
                { id: "fill", label: "Solid Box Fill", desc: "Fills whole boundary box" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() =>
                    onChangeMaskConfig({
                      ...maskConfig,
                      thresholdMode: mode.id as MaskThresholdMode,
                    })
                  }
                  className={`p-2 rounded-lg text-left text-xs font-mono transition-all border ${
                    maskConfig.thresholdMode === mode.id
                      ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                      : "bg-neutral-800/60 text-neutral-400 border-neutral-700/60 hover:bg-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  <div className="font-bold">{mode.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Morphological Dilation & Sensitivity */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">
              Morphological Refinement
            </h4>

            {/* Dilation Radius */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-neutral-300">Dilation Radius (cv.dilate)</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      onChangeMaskConfig({
                        ...maskConfig,
                        dilationRadius: Math.max(0, maskConfig.dilationRadius - 1),
                      })
                    }
                    className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                    title="Réduire l'expansion du masque (-1px)"
                  >
                    -1px
                  </button>
                  <span className="text-amber-400 font-bold px-1">{maskConfig.dilationRadius} px</span>
                  <button
                    onClick={() =>
                      onChangeMaskConfig({
                        ...maskConfig,
                        dilationRadius: Math.min(12, maskConfig.dilationRadius + 1),
                      })
                    }
                    className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                    title="Augmenter l'expansion du masque (+1px)"
                  >
                    +1px
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={maskConfig.dilationRadius}
                onChange={(e) =>
                  onChangeMaskConfig({
                    ...maskConfig,
                    dilationRadius: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">
                Ajuste l'épaisseur du masque autour des lettres et contours du filigrane.
              </p>
            </div>

            {/* Sensitivity */}
            {maskConfig.thresholdMode !== "fill" && (
              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-neutral-300">Detection Sensitivity</span>
                  <span className="text-amber-400 font-bold">{maskConfig.sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="95"
                  step="1"
                  value={maskConfig.sensitivity}
                  onChange={(e) =>
                    onChangeMaskConfig({
                      ...maskConfig,
                      sensitivity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            )}

            {/* Invert mask toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <span className="text-xs font-mono text-neutral-300">Invert Mask (Dark on Light)</span>
              <button
                onClick={() =>
                  onChangeMaskConfig({
                    ...maskConfig,
                    invertMask: !maskConfig.invertMask,
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  maskConfig.invertMask ? "bg-amber-500" : "bg-neutral-800"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    maskConfig.invertMask ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Manual Touch-Up Brush */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center justify-between">
              <span>Manual Brush Touch-Up</span>
              {brushMode !== "none" && (
                <span className="text-[10px] text-amber-400 font-bold">Active</span>
              )}
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setBrushMode(brushMode === "add" ? "none" : "add")}
                className={`p-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border transition-all ${
                  brushMode === "add"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
                    : "bg-neutral-800/60 text-neutral-300 border-neutral-700/60 hover:bg-neutral-800"
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5 text-rose-400" />
                <span>Add Mask</span>
              </button>

              <button
                onClick={() => setBrushMode(brushMode === "erase" ? "none" : "erase")}
                className={`p-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border transition-all ${
                  brushMode === "erase"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                    : "bg-neutral-800/60 text-neutral-300 border-neutral-700/60 hover:bg-neutral-800"
                }`}
              >
                <Eraser className="w-3.5 h-3.5 text-emerald-400" />
                <span>Erase</span>
              </button>

              <button
                onClick={() => {
                  setBrushMode("none");
                  const srcCanvas = getSourceCanvas();
                  const mask = generatePreciseMask(srcCanvas, boxes, maskConfig);
                  internalMaskCanvasRef.current = mask;
                  onMaskReady(mask);
                  renderPreview();
                }}
                className="p-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60 transition-colors"
                title="Reset brush edits"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {brushMode !== "none" && (
              <div className="pt-2">
                <div className="flex justify-between text-xs font-mono mb-1 text-neutral-400">
                  <span>Brush Radius</span>
                  <span>{brushSize} px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
