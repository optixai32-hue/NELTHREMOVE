import React, { useState } from "react";
import { InpaintConfig, PipelineMetrics } from "../types";
import { openCVLoader } from "../services/opencvLoader";
import {
  Wand2,
  Cpu,
  Layers,
  Sparkles,
  Info,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface InpaintSettingsViewProps {
  inpaintConfig: InpaintConfig;
  onChangeInpaintConfig: (cfg: InpaintConfig) => void;
  onExecuteInpaint: () => Promise<void>;
  isProcessing: boolean;
  metrics: PipelineMetrics | null;
  hasInpaintedResult: boolean;
  onProceedToExport: () => void;
}

export const InpaintSettingsView: React.FC<InpaintSettingsViewProps> = ({
  inpaintConfig,
  onChangeInpaintConfig,
  onExecuteInpaint,
  isProcessing,
  metrics,
  hasInpaintedResult,
  onProceedToExport,
}) => {
  const [selectedAlgo, setSelectedAlgo] = useState<"telea" | "ns">(inpaintConfig.algorithm);

  const handleAlgorithmChange = (algo: "telea" | "ns") => {
    setSelectedAlgo(algo);
    onChangeInpaintConfig({ ...inpaintConfig, algorithm: algo });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* Banner */}
      <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wand2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-white font-sans">
              Step 5: Telea Fast Marching Inpainting
            </h3>
          </div>
          <p className="text-xs text-neutral-400 font-mono">
            Execute Alexandru Telea's Fast Marching Method (FMM) to reconstruct pixels beneath the mask.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-execute-telea-inpaint"
            onClick={onExecuteInpaint}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 text-xs font-mono font-bold uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Telea Inpaint...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>{hasInpaintedResult ? "Re-Run Inpaint" : "Execute Telea Inpaint"}</span>
              </>
            )}
          </button>

          {hasInpaintedResult && (
            <button
              id="btn-proceed-export"
              onClick={onProceedToExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-semibold border border-neutral-700 transition-colors"
            >
              <span>Next: Output Export</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inpainting Engine & Algorithm */}
        <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center justify-between">
            <span>Inpainting Algorithm</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              {openCVLoader.isReady() ? "OpenCV.js WASM Ready" : "Native Telea Ready"}
            </span>
          </h4>

          {/* Telea vs NS option */}
          <div className="space-y-3">
            <div
              onClick={() => handleAlgorithmChange("telea")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedAlgo === "telea"
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-100 shadow-sm"
                  : "bg-neutral-800/40 border-neutral-700/60 text-neutral-400 hover:bg-neutral-800/80"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs font-mono">Telea Method (Recommended)</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                    cv.INPAINT_TELEA
                  </span>
                </div>
                {selectedAlgo === "telea" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Uses the Fast Marching Method to propagate boundary colors along gradient isophotes. Prevents blur and preserves crisp background textures across text and watermark glyphs.
              </p>
            </div>

            <div
              onClick={() => handleAlgorithmChange("ns")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedAlgo === "ns"
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-100 shadow-sm"
                  : "bg-neutral-800/40 border-neutral-700/60 text-neutral-400 hover:bg-neutral-800/80"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs font-mono">Navier-Stokes (Fluid Dynamics)</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-700 text-neutral-300">
                    cv.INPAINT_NS
                  </span>
                </div>
                {selectedAlgo === "ns" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Reconstructs lines of equal intensity based on partial differential equations. Best for broad continuous gradations or smooth skies.
              </p>
            </div>
          </div>
        </div>

        {/* Inpaint Radius & Fine Parameters */}
        <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">
            Neighborhood Parameters
          </h4>

          {/* Inpaint Radius */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-neutral-300">Inpaint Neighborhood Radius</span>
              <span className="text-amber-400 font-bold">{inpaintConfig.radius} px</span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              step="1"
              value={inpaintConfig.radius}
              onChange={(e) =>
                onChangeInpaintConfig({
                  ...inpaintConfig,
                  radius: Number(e.target.value),
                })
              }
              className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-neutral-400 mt-1 font-mono">
              Smaller radius (3-5px) preserves fine detail around small letters. Larger radius (7-12px) blends larger solid stamps.
            </p>
          </div>

          {/* Telemetry card if inpainting has occurred */}
          {metrics && (
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-2 mt-4">
              <div className="text-[11px] font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Last Telea Run Completed</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-neutral-500">Duration:</span>{" "}
                  <span className="text-neutral-200 font-bold">{metrics.inpaintTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-neutral-500">Inpainted Pixels:</span>{" "}
                  <span className="text-neutral-200 font-bold">
                    {metrics.pixelsInpainted?.toLocaleString() || "0"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-neutral-500">Engine Used:</span>{" "}
                  <span className="text-amber-300 font-semibold">
                    {metrics.engineUsed === "opencv-wasm" ? "OpenCV.js WASM" : "Fast Marching Telea (FMM)"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Technical Info Box */}
          <div className="p-3 bg-neutral-800/40 rounded-lg border border-neutral-700/60 flex items-start gap-2.5 text-xs text-neutral-400">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Mathematical guarantee:</strong> The Fast Marching algorithm marches from the outer boundary inward, solving the Eikonal equation $|\nabla T| = 1$ to interpolate pixel values using directional, distance, and level set weighting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
