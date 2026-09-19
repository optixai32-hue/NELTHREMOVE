import React, { useEffect, useState } from "react";
import { openCVLoader, OpenCVStatus } from "../services/opencvLoader";
import {
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Code2,
  Terminal,
} from "lucide-react";

interface OpenCVStatusViewProps {
  onProceed: () => void;
}

export const OpenCVStatusView: React.FC<OpenCVStatusViewProps> = ({ onProceed }) => {
  const [cvStatus, setCvStatus] = useState<OpenCVStatus>(openCVLoader.getStatus());
  const [opencvVersion, setOpencvVersion] = useState<string>("4.8.0");
  const [functionsLoaded, setFunctionsLoaded] = useState<string[]>([]);

  useEffect(() => {
    const unsub = openCVLoader.subscribe((status) => {
      setCvStatus(status);
      if (status === "ready" && window.cv) {
        setOpencvVersion(window.cv.VERSION || "4.8.0-wasm");
        const funcs = [];
        if (window.cv.inpaint) funcs.push("cv.inpaint");
        if (window.cv.threshold) funcs.push("cv.threshold");
        if (window.cv.dilate) funcs.push("cv.dilate");
        if (window.cv.cvtColor) funcs.push("cv.cvtColor");
        if (window.cv.Mat) funcs.push("cv.Mat");
        setFunctionsLoaded(funcs);
      }
    });

    openCVLoader.load();
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* Header Banner */}
      <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-white font-sans">
              Step 3: OpenCV.js / OpenCV Node Architecture
            </h3>
          </div>
          <p className="text-xs text-neutral-400 font-mono">
            High-performance Computer Vision runtime compiled to WebAssembly (WASM) & Node.js backend.
          </p>
        </div>

        <button
          id="btn-proceed-from-opencv"
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-mono font-bold uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95"
        >
          <span>Proceed to Precise Mask</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client OpenCV.js Engine */}
        <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Client WebAssembly Engine</span>
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                cvStatus === "ready"
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                  : cvStatus === "loading"
                  ? "bg-amber-950/60 text-amber-300 border-amber-500/40 animate-pulse"
                  : "bg-blue-950/60 text-blue-300 border-blue-500/40"
              }`}
            >
              {cvStatus === "ready"
                ? "Active (Ready)"
                : cvStatus === "loading"
                ? "Loading WASM..."
                : "Active (Native Telea)"}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Library:</span>
              <span className="text-white font-bold">OpenCV.js ({opencvVersion})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Inpainting Mode:</span>
              <span className="text-amber-400 font-bold">cv.INPAINT_TELEA</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Mask Processing:</span>
              <span className="text-neutral-200">cv.dilate &bull; cv.threshold</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Fallback Resilience:</span>
              <span className="text-emerald-400">Fast Marching Native Built-in</span>
            </div>
          </div>

          {/* Bound methods list */}
          <div className="pt-2">
            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono block mb-2">
              Bound OpenCV Computer Vision Primitives
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                "cv.inpaint",
                "cv.threshold",
                "cv.dilate",
                "cv.cvtColor",
                "cv.GaussianBlur",
                "cv.MORPH_ELLIPSE",
                "cv.INPAINT_TELEA",
              ].map((fn) => (
                <span
                  key={fn}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/80"
                >
                  {fn}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Node.js Backend Engine */}
        <div className="bg-neutral-900/50 p-5 rounded-xl border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Node.js & AI Vision Server</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/40">
              Port 3000 Active
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Server Runtime:</span>
              <span className="text-white font-bold">Node.js + Express</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Detection Endpoint:</span>
              <span className="text-amber-300 font-bold">/api/detect-watermark</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">AI Vision Model:</span>
              <span className="text-neutral-200">Gemini 3.8 Flash</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Max Payload Limit:</span>
              <span className="text-emerald-400">50 MB High-Res Image Stream</span>
            </div>
          </div>

          <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-[11px] text-neutral-300">
            <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>Architecture Pipeline Stack:</span>
            </div>
            <p className="text-neutral-400 text-[10px] leading-relaxed">
              Express proxies AI watermark bounding coordinates; OpenCV.js performs client-side WebAssembly morphological dilation & Fast Marching Telea inpainting without network latency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
