import React, { useEffect, useState } from "react";
import { openCVLoader, OpenCVStatus } from "../services/opencvLoader";
import {
  Sparkles,
  Cpu,
  Layers,
  CheckCircle2,
  RefreshCw,
  Play,
  RotateCcw,
} from "lucide-react";

interface HeaderProps {
  onReset: () => void;
  onRunFullPipeline: () => void;
  isProcessing: boolean;
  canRunPipeline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onRunFullPipeline,
  isProcessing,
  canRunPipeline,
}) => {
  const [cvStatus, setCvStatus] = useState<OpenCVStatus>(openCVLoader.getStatus());
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [hasGemini, setHasGemini] = useState(false);

  useEffect(() => {
    const unsub = openCVLoader.subscribe(setCvStatus);
    openCVLoader.load();

    // Check backend health
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus("online");
        setHasGemini(Boolean(data.hasGeminiKey));
      })
      .catch(() => {
        setBackendStatus("offline");
      });

    return () => unsub();
  }, []);

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-neutral-900 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon
                points="16,2 29,9.5 29,22.5 16,30 3,22.5 3,9.5"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <path
                d="M10 22V10L22 22V10"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="16" r="2.5" fill="#f59e0b" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white font-sans">
                Nelth-IA
              </h1>
              <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold">
                Watermark Studio
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono">
              OpenCV.js &bull; Telea Inpainting &bull; Precision Masking
            </p>
          </div>
        </div>

        {/* Runtime Status Badges */}
        <div className="hidden lg:flex items-center gap-2">
          {/* OpenCV.js Status */}
          <div
            id="badge-opencv-status"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
              cvStatus === "ready"
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                : cvStatus === "loading"
                ? "bg-amber-950/40 text-amber-300 border-amber-500/30 animate-pulse"
                : "bg-blue-950/40 text-blue-300 border-blue-500/30"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {cvStatus === "ready"
                ? "OpenCV.js 4.8 WASM"
                : cvStatus === "loading"
                ? "Loading OpenCV..."
                : "FMM Telea Native"}
            </span>
          </div>

          {/* Node.js Express Status */}
          <div
            id="badge-node-status"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
              backendStatus === "online"
                ? "bg-neutral-800/80 text-neutral-300 border-neutral-700"
                : "bg-red-950/40 text-red-300 border-red-500/30"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Node / Express</span>
          </div>

          {/* Gemini AI Status */}
          <div
            id="badge-gemini-status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-purple-950/40 text-purple-300 border border-purple-500/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{hasGemini ? "Gemini 3.8 AI" : "Heuristic + AI"}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            id="btn-run-pipeline"
            onClick={onRunFullPipeline}
            disabled={!canRunPipeline || isProcessing}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all shadow-md ${
              canRunPipeline && !isProcessing
                ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-amber-500/20 active:scale-95"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Auto-Run Pipeline</span>
              </>
            )}
          </button>

          <button
            id="btn-reset-app"
            onClick={onReset}
            title="Reset Pipeline"
            className="p-2 rounded-lg text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
