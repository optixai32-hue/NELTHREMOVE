import React, { useState, useRef, useEffect } from "react";
import {
  PipelineStep,
  WatermarkBox,
  MaskConfig,
  InpaintConfig,
  PipelineMetrics,
} from "./types";
import { Header } from "./components/Header";
import { PipelineStepper } from "./components/PipelineStepper";
import { ImageUploader } from "./components/ImageUploader";
import { WatermarkDetectorView } from "./components/WatermarkDetectorView";
import { OpenCVStatusView } from "./components/OpenCVStatusView";
import { MaskInspectorView } from "./components/MaskInspectorView";
import { InpaintSettingsView } from "./components/InpaintSettingsView";
import { ComparisonViewer } from "./components/ComparisonViewer";
import { detectWatermarks, getPresetBox, getWatermarkBoxForRatio, AspectRatioType } from "./services/watermarkDetector";
import { generatePreciseMask } from "./services/maskGenerator";
import { runTeleaInpaint } from "./services/teleaInpainter";
import { openCVLoader } from "./services/opencvLoader";

export default function App() {
  const [currentStep, setCurrentStep] = useState<PipelineStep>("upload");
  const [completedSteps, setCompletedSteps] = useState<PipelineStep[]>([]);

  // Pipeline Data State
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size?: string } | null>(null);
  const [boxes, setBoxes] = useState<WatermarkBox[]>([]);
  const [detectionSource, setDetectionSource] = useState<string | undefined>(undefined);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  // Mask Configuration
  const [maskConfig, setMaskConfig] = useState<MaskConfig>({
    thresholdMode: "otsu",
    sensitivity: 75,
    dilationRadius: 2,
    invertMask: false,
    edgeBlur: 1,
  });
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null);

  // Inpaint Configuration & Result
  const [inpaintConfig, setInpaintConfig] = useState<InpaintConfig>({
    algorithm: "telea",
    radius: 5,
    passes: 1,
  });
  const [inpaintedCanvas, setInpaintedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);

  // Pre-load OpenCV on start
  useEffect(() => {
    openCVLoader.load();
  }, []);

  const getSourceCanvas = (): HTMLCanvasElement | null => {
    if (!sourceImage) return null;
    const canvas = document.createElement("canvas");
    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(sourceImage, 0, 0);
    return canvas;
  };

  const handleImageLoaded = (img: HTMLImageElement, info: { name: string; size?: string }) => {
    setSourceImage(img);
    setFileInfo(info);

    // Initial default bottom-right watermark box adapted to image aspect ratio
    const aspect = img.naturalWidth / img.naturalHeight;
    let ratioType: AspectRatioType = "1:1";
    if (aspect > 1.35) {
      ratioType = "16:9";
    } else if (aspect < 0.75) {
      ratioType = "9:16";
    }

    const defaultBox = getWatermarkBoxForRatio(ratioType);
    setBoxes([defaultBox]);
    setCompletedSteps(["upload"]);
    setCurrentStep("detect");
  };

  const handleDetectAuto = async () => {
    const srcCanvas = getSourceCanvas();
    if (!srcCanvas) return;

    setIsDetecting(true);
    try {
      const res = await detectWatermarks(srcCanvas);
      if (res.watermarks && res.watermarks.length > 0) {
        setBoxes(res.watermarks);
      }
      setDetectionSource(res.source);
    } catch (err) {
      console.error("Auto detect failed:", err);
    } finally {
      setIsDetecting(false);
    }
  };

  const executeInpaint = async (): Promise<boolean> => {
    const srcCanvas = getSourceCanvas();
    if (!srcCanvas) return false;

    // Ensure we have a mask
    let targetMask = maskCanvas;
    if (!targetMask) {
      targetMask = generatePreciseMask(srcCanvas, boxes, maskConfig);
      setMaskCanvas(targetMask);
    }

    setIsProcessing(true);
    try {
      const result = await runTeleaInpaint(
        srcCanvas,
        targetMask,
        inpaintConfig.radius,
        inpaintConfig.algorithm
      );

      const outCanvas = document.createElement("canvas");
      outCanvas.width = srcCanvas.width;
      outCanvas.height = srcCanvas.height;
      const ctx = outCanvas.getContext("2d")!;
      ctx.putImageData(result.imageData, 0, 0);

      setInpaintedCanvas(outCanvas);
      setMetrics({
        inpaintTimeMs: result.durationMs,
        engineUsed: result.engineUsed,
        pixelsInpainted: result.pixelsInpainted,
        originalSize: { width: srcCanvas.width, height: srcCanvas.height },
      });

      setCompletedSteps((prev) => Array.from(new Set([...prev, "opencv", "mask", "inpaint"])));
      return true;
    } catch (err) {
      console.error("Inpainting execution failed:", err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Automated one-click execution of entire pipeline
  const handleRunFullPipeline = async () => {
    const srcCanvas = getSourceCanvas();
    if (!srcCanvas) return;

    setIsProcessing(true);
    try {
      // 1. Detect watermark zone if not already detected
      if (boxes.length === 0) {
        const detResult = await detectWatermarks(srcCanvas);
        setBoxes(detResult.watermarks);
        setDetectionSource(detResult.source);
      }

      // 2. Generate precise mask
      const currentBoxes = boxes.length > 0 ? boxes : [getPresetBox("bottom-right")];
      const generatedMask = generatePreciseMask(srcCanvas, currentBoxes, maskConfig);
      setMaskCanvas(generatedMask);

      // 3. Run Telea Inpainting
      const inpaintResult = await runTeleaInpaint(
        srcCanvas,
        generatedMask,
        inpaintConfig.radius,
        inpaintConfig.algorithm
      );

      const outCanvas = document.createElement("canvas");
      outCanvas.width = srcCanvas.width;
      outCanvas.height = srcCanvas.height;
      const ctx = outCanvas.getContext("2d")!;
      ctx.putImageData(inpaintResult.imageData, 0, 0);

      setInpaintedCanvas(outCanvas);
      setMetrics({
        inpaintTimeMs: inpaintResult.durationMs,
        engineUsed: inpaintResult.engineUsed,
        pixelsInpainted: inpaintResult.pixelsInpainted,
        originalSize: { width: srcCanvas.width, height: srcCanvas.height },
      });

      // Mark all completed & jump to final export
      setCompletedSteps(["upload", "detect", "opencv", "mask", "inpaint", "export"]);
      setCurrentStep("export");
    } catch (err) {
      console.error("Full pipeline run failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setFileInfo(null);
    setBoxes([]);
    setMaskCanvas(null);
    setInpaintedCanvas(null);
    setMetrics(null);
    setCompletedSteps([]);
    setCurrentStep("upload");
  };

  const canNavigateTo = (step: PipelineStep): boolean => {
    if (step === "upload") return true;
    if (!sourceImage) return false;
    if (step === "detect" || step === "opencv" || step === "mask") return true;
    if (step === "inpaint") return boxes.length > 0;
    if (step === "export") return Boolean(inpaintedCanvas);
    return false;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        onReset={handleReset}
        onRunFullPipeline={handleRunFullPipeline}
        isProcessing={isProcessing}
        canRunPipeline={Boolean(sourceImage)}
      />

      {/* Pipeline Navigation Stepper */}
      <PipelineStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onSelectStep={setCurrentStep}
        canNavigateTo={canNavigateTo}
      />

      {/* Main Pipeline Stage Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4">
        {currentStep === "upload" && (
          <ImageUploader
            currentImage={sourceImage}
            onImageLoaded={handleImageLoaded}
            onProceed={() => setCurrentStep("detect")}
          />
        )}

        {currentStep === "detect" && sourceImage && (
          <WatermarkDetectorView
            image={sourceImage}
            boxes={boxes}
            onChangeBoxes={setBoxes}
            onDetectAuto={handleDetectAuto}
            isDetecting={isDetecting}
            detectionSource={detectionSource}
            onProceed={() => {
              setCompletedSteps((prev) => Array.from(new Set([...prev, "detect"])));
              setCurrentStep("opencv");
            }}
          />
        )}

        {currentStep === "opencv" && (
          <OpenCVStatusView
            onProceed={() => {
              setCompletedSteps((prev) => Array.from(new Set([...prev, "opencv"])));
              setCurrentStep("mask");
            }}
          />
        )}

        {currentStep === "mask" && sourceImage && (
          <MaskInspectorView
            sourceImage={sourceImage}
            boxes={boxes}
            maskConfig={maskConfig}
            onChangeMaskConfig={setMaskConfig}
            onMaskReady={setMaskCanvas}
            onProceedToInpaint={() => {
              setCompletedSteps((prev) => Array.from(new Set([...prev, "mask"])));
              setCurrentStep("inpaint");
            }}
          />
        )}

        {currentStep === "inpaint" && (
          <InpaintSettingsView
            inpaintConfig={inpaintConfig}
            onChangeInpaintConfig={setInpaintConfig}
            onExecuteInpaint={async () => {
              const ok = await executeInpaint();
              if (ok) {
                setCompletedSteps((prev) => Array.from(new Set([...prev, "inpaint", "export"])));
                setCurrentStep("export");
              }
            }}
            isProcessing={isProcessing}
            metrics={metrics}
            hasInpaintedResult={Boolean(inpaintedCanvas)}
            onProceedToExport={() => {
              setCompletedSteps((prev) => Array.from(new Set([...prev, "inpaint", "export"])));
              setCurrentStep("export");
            }}
          />
        )}

        {currentStep === "export" && sourceImage && inpaintedCanvas && (
          <ComparisonViewer
            originalImage={sourceImage}
            inpaintedCanvas={inpaintedCanvas}
            metrics={metrics}
            boxes={boxes}
          />
        )}
      </main>

      {/* Footer bar */}
      <footer className="border-t border-neutral-800/80 bg-neutral-900/40 py-3 text-center text-xs font-mono text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>
            Pipeline: Upload &rarr; Detect Zone &rarr; OpenCV.js &rarr; Precise Mask &rarr; Telea Inpaint &rarr; Clean PNG/JPEG Export
          </span>
          <span className="text-neutral-400">
            Alexander Telea Fast Marching Inpainting &bull; OpenCV.js WebAssembly
          </span>
        </div>
      </footer>
    </div>
  );
}
