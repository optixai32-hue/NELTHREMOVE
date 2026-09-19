import React from "react";
import { PipelineStep } from "../types";
import {
  Upload,
  ScanEye,
  Cpu,
  Scissors,
  Wand2,
  Download,
  Check,
} from "lucide-react";

interface PipelineStepperProps {
  currentStep: PipelineStep;
  completedSteps: PipelineStep[];
  onSelectStep: (step: PipelineStep) => void;
  canNavigateTo: (step: PipelineStep) => boolean;
}

interface StepItem {
  id: PipelineStep;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepItem[] = [
  {
    id: "upload",
    title: "1. Upload",
    subtitle: "Select or drop image",
    icon: Upload,
  },
  {
    id: "detect",
    title: "2. Detect Zone",
    subtitle: "AI / Manual bounding",
    icon: ScanEye,
  },
  {
    id: "opencv",
    title: "3. OpenCV.js",
    subtitle: "WASM engine prep",
    icon: Cpu,
  },
  {
    id: "mask",
    title: "4. Precise Mask",
    subtitle: "Otsu & dilation",
    icon: Scissors,
  },
  {
    id: "inpaint",
    title: "5. Inpaint Telea",
    subtitle: "Fast Marching FMM",
    icon: Wand2,
  },
  {
    id: "export",
    title: "6. Output Export",
    subtitle: "Clean PNG / JPEG",
    icon: Download,
  },
];

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  currentStep,
  completedSteps,
  onSelectStep,
  canNavigateTo,
}) => {
  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/40 overflow-x-auto py-2.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between min-w-[760px] gap-2">
        {STEPS.map((step, idx) => {
          const isCurrent = currentStep === step.id;
          const isCompleted = completedSteps.includes(step.id);
          const isEnabled = canNavigateTo(step.id);
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <button
                id={`step-btn-${step.id}`}
                onClick={() => isEnabled && onSelectStep(step.id)}
                disabled={!isEnabled}
                className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all relative ${
                  isCurrent
                    ? "bg-amber-500/15 border border-amber-500/40 text-amber-200 shadow-sm"
                    : isCompleted
                    ? "text-neutral-200 hover:bg-neutral-800/80 cursor-pointer"
                    : isEnabled
                    ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 cursor-pointer"
                    : "text-neutral-600 opacity-60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isCurrent
                      ? "bg-amber-500 text-neutral-950 shadow-sm"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700/60"
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="leading-tight">
                  <div className="text-xs font-semibold tracking-tight">
                    {step.title}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono hidden md:block">
                    {step.subtitle}
                  </div>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <div className="text-neutral-700 select-none px-1 text-xs">
                  &rarr;
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
