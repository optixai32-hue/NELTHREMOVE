import React, { useState, useRef, useEffect } from "react";
import { PipelineMetrics, WatermarkBox, LogoOverlayConfig } from "../types";
import { applyLogoOverlay, DEFAULT_LOGO_SETTINGS } from "../services/logoOverlay";
import {
  Download,
  Copy,
  Check,
  SplitSquareVertical,
  Columns,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  Cpu,
  Layers,
  Clock,
  Stamp,
  Sliders,
  Eye,
  EyeOff,
} from "lucide-react";

interface ComparisonViewerProps {
  originalImage: HTMLImageElement;
  inpaintedCanvas: HTMLCanvasElement;
  metrics: PipelineMetrics | null;
  boxes?: WatermarkBox[];
}

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  originalImage,
  inpaintedCanvas,
  metrics,
  boxes = [],
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"split" | "side-by-side">("split");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [jpegQuality, setJpegQuality] = useState<number>(92);
  const [copied, setCopied] = useState<boolean>(false);

  // Logo replacement state (50% opacity, compact size, enabled by default)
  const [logoConfig, setLogoConfig] = useState<LogoOverlayConfig>(DEFAULT_LOGO_SETTINGS);
  const [displayCanvas, setDisplayCanvas] = useState<HTMLCanvasElement>(inpaintedCanvas);
  const [displayDataUrl, setDisplayDataUrl] = useState<string>(() => inpaintedCanvas.toDataURL("image/png"));

  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const baseImgRef = useRef<HTMLImageElement>(null);

  // Re-render canvas with logo overlay whenever inpainting or logo settings change
  useEffect(() => {
    let isMounted = true;
    const generateOutput = async () => {
      if (logoConfig.enabled && boxes.length > 0) {
        const stamped = await applyLogoOverlay(inpaintedCanvas, boxes, logoConfig);
        if (isMounted) {
          setDisplayCanvas(stamped);
          setDisplayDataUrl(stamped.toDataURL("image/png"));
        }
      } else {
        if (isMounted) {
          setDisplayCanvas(inpaintedCanvas);
          setDisplayDataUrl(inpaintedCanvas.toDataURL("image/png"));
        }
      }
    };
    generateOutput();
    return () => {
      isMounted = false;
    };
  }, [inpaintedCanvas, boxes, logoConfig]);

  const updateImageDimensions = () => {
    if (baseImgRef.current) {
      setImageDims({
        width: baseImgRef.current.clientWidth,
        height: baseImgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    updateImageDimensions();
    window.addEventListener("resize", updateImageDimensions);
    return () => window.removeEventListener("resize", updateImageDimensions);
  }, [displayDataUrl, zoomLevel]);

  const getFinalCanvas = (): HTMLCanvasElement => displayCanvas;

  const handleSliderMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, pos)));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleDownload = () => {
    const finalCanvas = getFinalCanvas();
    const mimeType = exportFormat === "png" ? "image/png" : "image/jpeg";
    const quality = exportFormat === "jpeg" ? jpegQuality / 100 : undefined;
    const dataUrl = finalCanvas.toDataURL(mimeType, quality);

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    link.download = `clean_inpainted_${timestamp}.${exportFormat}`;
    link.href = dataUrl;
    link.click();
  };

  const handleCopyToClipboard = async () => {
    try {
      const finalCanvas = getFinalCanvas();
      finalCanvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }, "image/png");
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Final Output & Before/After Comparison
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Compare original watermarked image against Telea inpainted result.
          </p>
        </div>

        {/* View Mode & Zoom Toggles */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-800 p-1 rounded-lg border border-neutral-700 text-xs font-mono">
            <button
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded flex items-center gap-1 ${
                viewMode === "split"
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-300 hover:text-white"
              }`}
              title="Split swipe slider"
            >
              <SplitSquareVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Split Slider</span>
            </button>
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`p-1.5 rounded flex items-center gap-1 ${
                viewMode === "side-by-side"
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-300 hover:text-white"
              }`}
              title="Side by side view"
            >
              <Columns className="w-4 h-4" />
              <span className="hidden sm:inline">Side-by-Side</span>
            </button>
          </div>

          <div className="flex items-center bg-neutral-800 p-1 rounded-lg border border-neutral-700 text-xs font-mono">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-700"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-neutral-300 text-[11px] font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-700"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoomLevel !== 1 && (
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-amber-400 hover:text-amber-300 rounded hover:bg-neutral-700 text-[10px]"
                title="Reset zoom"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Comparison Stage */}
      <div className="flex flex-col items-center">
        {viewMode === "split" ? (
          <div
            ref={containerRef}
            id="split-comparison-container"
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onMouseMove={(e) => isDragging && handleSliderMove(e.clientX)}
            onTouchMove={handleTouchMove}
            className="relative select-none rounded-2xl overflow-hidden border border-neutral-700 bg-neutral-950 shadow-2xl max-w-full cursor-ew-resize group"
            style={{ maxHeight: "580px" }}
          >
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease",
              }}
              className="relative max-h-[580px]"
            >
              {/* Inpainted Image with optional replacement logo (Background) */}
              <img
                ref={baseImgRef}
                src={displayDataUrl}
                alt="Inpainted Telea Result"
                onLoad={updateImageDimensions}
                className="max-h-[580px] object-contain block pointer-events-none select-none"
                draggable={false}
              />

              {/* Original Watermarked Image (Clipped Foreground) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={originalImage.src}
                  alt="Original with Watermark"
                  className="max-h-[580px] object-contain block pointer-events-none select-none max-w-none"
                  style={{
                    width: imageDims.width > 0 ? `${imageDims.width}px` : "auto",
                    height: imageDims.height > 0 ? `${imageDims.height}px` : "auto",
                  }}
                  draggable={false}
                />
              </div>

              {/* Draggable Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(245,158,11,0.8)] cursor-ew-resize"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold font-mono">
                  &harr;
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-mono text-neutral-300 pointer-events-none">
                Original (With Watermark)
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-amber-500/90 backdrop-blur-md text-neutral-950 text-[11px] font-mono font-bold pointer-events-none shadow flex items-center gap-1.5">
                <span>{logoConfig.enabled ? `Inpainted + Logo (${Math.round(logoConfig.opacity * 100)}%)` : "Clean Inpainted (Telea FMM)"}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Side by Side View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 p-2 text-center">
              <span className="text-xs font-mono text-neutral-400 block mb-2 font-semibold">
                Original Image (With Watermark)
              </span>
              <img
                src={originalImage.src}
                alt="Original"
                className="max-h-[440px] mx-auto object-contain rounded-lg"
              />
            </div>
            <div className="rounded-xl overflow-hidden border border-amber-500/30 bg-neutral-950 p-2 text-center">
              <span className="text-xs font-mono text-amber-300 block mb-2 font-semibold">
                {logoConfig.enabled ? `Restored Result + Custom Logo (${Math.round(logoConfig.opacity * 100)}% Opacity)` : "Clean Restored Result (Watermark Removed)"}
              </span>
              <img
                src={displayDataUrl}
                alt="Restored Result"
                className="max-h-[440px] mx-auto object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* Export Controls & Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* Export format & download */}
        <div className="md:col-span-2 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200 font-mono flex items-center justify-between">
            <span>Download High-Resolution Image</span>
            <span className="text-[10px] text-neutral-400">
              {inpaintedCanvas.width} &times; {inpaintedCanvas.height} px
            </span>
          </h4>

          {/* Logo Replacement Option (Active by default, 50% opacity, petite taille) */}
          <div className="bg-neutral-950/80 border border-neutral-700/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stamp className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold font-mono text-white">
                  Remplacer le filigrane effacé par le Logo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Opacité {Math.round(logoConfig.opacity * 100)}% &bull; Taille {Math.round(logoConfig.sizeScale * 100)}%
                </span>
              </div>

              <button
                id="toggle-logo-overlay"
                onClick={() => setLogoConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-3 py-1 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-all ${
                  logoConfig.enabled
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                    : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                }`}
              >
                {logoConfig.enabled ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Logo Actif</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Sans Logo</span>
                  </>
                )}
              </button>
            </div>

            {logoConfig.enabled && (
              <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                {/* Opacity slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-neutral-400">
                    <span>Opacité :</span>
                    <span className="text-amber-300 font-bold">{Math.round(logoConfig.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={Math.round(logoConfig.opacity * 100)}
                    onChange={(e) =>
                      setLogoConfig((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))
                    }
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Discret (20%)</span>
                    <span className="text-amber-400/80 font-bold">Défaut (40%)</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Size scale slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-neutral-400">
                    <span>Taille du logo :</span>
                    <span className="text-amber-300 font-bold">{Math.round(logoConfig.sizeScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="200"
                    step="5"
                    value={Math.round(logoConfig.sizeScale * 100)}
                    onChange={(e) =>
                      setLogoConfig((prev) => ({ ...prev, sizeScale: Number(e.target.value) / 100 }))
                    }
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Compact (50%)</span>
                    <span className="text-amber-400/80 font-bold">Défaut (100%)</span>
                    <span>Grand (200%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Format choice */}
            <div className="flex items-center gap-2 bg-neutral-800 p-1 rounded-xl border border-neutral-700">
              <button
                id="btn-format-png"
                onClick={() => setExportFormat("png")}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
                  exportFormat === "png"
                    ? "bg-amber-500 text-neutral-950 font-bold shadow-sm"
                    : "text-neutral-300 hover:text-white"
                }`}
              >
                PNG (Lossless)
              </button>
              <button
                id="btn-format-jpeg"
                onClick={() => setExportFormat("jpeg")}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
                  exportFormat === "jpeg"
                    ? "bg-amber-500 text-neutral-950 font-bold shadow-sm"
                    : "text-neutral-300 hover:text-white"
                }`}
              >
                JPEG
              </button>
            </div>

            {/* JPEG Quality Slider */}
            {exportFormat === "jpeg" && (
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <span className="text-xs font-mono text-neutral-400">
                  Quality: {jpegQuality}%
                </span>
                <input
                  type="range"
                  min="60"
                  max="100"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="btn-download-output"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs uppercase font-mono tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download {exportFormat.toUpperCase()}</span>
            </button>

            <button
              id="btn-copy-clipboard"
              onClick={handleCopyToClipboard}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-mono border border-neutral-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Image</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pipeline Execution Telemetry */}
        <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Pipeline Telemetry</span>
          </h4>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Inpainting Engine</span>
              <span className="text-amber-300 font-bold">
                {metrics?.engineUsed === "opencv-wasm" ? "OpenCV.js WASM" : "Fast Marching Telea"}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Inpainting Time</span>
              <span className="text-neutral-200 font-bold">
                {metrics?.inpaintTimeMs ? `${metrics.inpaintTimeMs} ms` : "Instant"}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Pixels Restored</span>
              <span className="text-neutral-200 font-bold">
                {metrics?.pixelsInpainted?.toLocaleString() || "N/A"}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Watermark Status</span>
              <span className="text-emerald-400 font-bold">
                Completely Cleaned
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Logo Remplacement</span>
              <span className={logoConfig.enabled ? "text-amber-300 font-bold" : "text-neutral-400"}>
                {logoConfig.enabled ? `Actif (${Math.round(logoConfig.opacity * 100)}% opacité)` : "Désactivé"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
