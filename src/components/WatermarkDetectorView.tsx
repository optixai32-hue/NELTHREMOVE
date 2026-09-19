import React, { useRef, useState, useEffect } from "react";
import { WatermarkBox } from "../types";
import {
  getPresetBox,
  shrinkBox,
  expandBox,
  AspectRatioType,
  PresetZoneType,
  getWatermarkBoxForRatio,
} from "../services/watermarkDetector";
import {
  Sparkles,
  Plus,
  Minus,
  Trash2,
  ScanEye,
  Check,
  ArrowRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Move,
} from "lucide-react";

interface WatermarkDetectorViewProps {
  image: HTMLImageElement;
  boxes: WatermarkBox[];
  onChangeBoxes: (boxes: WatermarkBox[]) => void;
  onDetectAuto: () => Promise<void>;
  isDetecting: boolean;
  detectionSource?: string;
  onProceed: () => void;
}

export const WatermarkDetectorView: React.FC<WatermarkDetectorViewProps> = ({
  image,
  boxes,
  onChangeBoxes,
  onDetectAuto,
  isDetecting,
  detectionSource,
  onProceed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(boxes[0]?.id || null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  // Drag & Move / Resize state
  const [interactionMode, setInteractionMode] = useState<"none" | "drawing" | "moving" | "resizing">("none");
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialBoxState, setInitialBoxState] = useState<WatermarkBox | null>(null);
  const [resizeHandle, setResizeHandle] = useState<"tl" | "tr" | "bl" | "br" | null>(null);

  // Sync selected box
  useEffect(() => {
    if (boxes.length > 0 && (!selectedBoxId || !boxes.find((b) => b.id === selectedBoxId))) {
      setSelectedBoxId(boxes[0].id);
    }
  }, [boxes, selectedBoxId]);

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  const handleShrinkSelected = (factor = 0.15) => {
    if (boxes.length === 0) return;
    if (!selectedBox) {
      onChangeBoxes(boxes.map((b) => shrinkBox(b, factor)));
      return;
    }
    onChangeBoxes(boxes.map((b) => (b.id === selectedBox.id ? shrinkBox(b, factor) : b)));
  };

  const handleExpandSelected = (factor = 0.15) => {
    if (boxes.length === 0) return;
    if (!selectedBox) {
      onChangeBoxes(boxes.map((b) => expandBox(b, factor)));
      return;
    }
    onChangeBoxes(boxes.map((b) => (b.id === selectedBox.id ? expandBox(b, factor) : b)));
  };

  const [activeRatio, setActiveRatio] = useState<AspectRatioType>("1:1");

  // Determine initial ratio based on image dimensions
  useEffect(() => {
    if (image) {
      const ratio = image.naturalWidth / image.naturalHeight;
      if (ratio > 1.4) {
        setActiveRatio("16:9");
      } else if (ratio < 0.7) {
        setActiveRatio("9:16");
      } else {
        setActiveRatio("1:1");
      }
    }
  }, [image]);

  const handleApplyRatioPreset = (ratio: AspectRatioType) => {
    setActiveRatio(ratio);
    const box = getWatermarkBoxForRatio(ratio);
    // Replace or add the bottom-right zone adapted to this ratio
    const filtered = boxes.filter((b) => !b.label.includes("Bottom-Right"));
    const updated = [box, ...filtered];
    onChangeBoxes(updated);
    setSelectedBoxId(box.id);
  };

  const handleAddPreset = (preset: PresetZoneType) => {
    const newBox = getPresetBox(preset);
    onChangeBoxes([...boxes, newBox]);
    setSelectedBoxId(newBox.id);
  };

  const handleDeleteBox = (id: string) => {
    const updated = boxes.filter((b) => b.id !== id);
    onChangeBoxes(updated);
    if (selectedBoxId === id) {
      setSelectedBoxId(updated[0]?.id || null);
    }
  };

  // Keyboard shortcut: Delete / Backspace removes active zone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBoxId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        handleDeleteBox(selectedBoxId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBoxId, boxes]);

  const handleMouseDownContainer = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we clicked on empty space on the canvas (not on a box)
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setInteractionMode("drawing");
    setIsDrawing(true);
    setDrawStart({ x, y });
  };

  const handleBoxMouseDown = (e: React.MouseEvent<HTMLDivElement>, box: WatermarkBox) => {
    e.stopPropagation();
    setSelectedBoxId(box.id);
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setInteractionMode("moving");
    setDragStartPos({ x, y });
    setInitialBoxState({ ...box });
  };

  const handleResizeHandleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    box: WatermarkBox,
    handle: "tl" | "tr" | "bl" | "br"
  ) => {
    e.stopPropagation();
    setSelectedBoxId(box.id);
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setInteractionMode("resizing");
    setResizeHandle(handle);
    setDragStartPos({ x, y });
    setInitialBoxState({ ...box });
  };

  // Global window mousemove and mouseup during dragging or resizing for maximum smoothness
  useEffect(() => {
    if (interactionMode === "none") return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      if (interactionMode === "moving" && dragStartPos && initialBoxState) {
        const deltaX = currentX - dragStartPos.x;
        const deltaY = currentY - dragStartPos.y;

        const width = initialBoxState.xmax - initialBoxState.xmin;
        const height = initialBoxState.ymax - initialBoxState.ymin;

        let newXmin = initialBoxState.xmin + deltaX;
        let newYmin = initialBoxState.ymin + deltaY;

        // Clamp within boundaries [0, 1]
        newXmin = Math.max(0, Math.min(1 - width, newXmin));
        newYmin = Math.max(0, Math.min(1 - height, newYmin));

        const newXmax = Number((newXmin + width).toFixed(3));
        const newYmax = Number((newYmin + height).toFixed(3));
        newXmin = Number(newXmin.toFixed(3));
        newYmin = Number(newYmin.toFixed(3));

        updateBoxCoord(initialBoxState.id, {
          xmin: newXmin,
          xmax: newXmax,
          ymin: newYmin,
          ymax: newYmax,
        });
      } else if (interactionMode === "resizing" && dragStartPos && initialBoxState && resizeHandle) {
        const deltaX = currentX - dragStartPos.x;
        const deltaY = currentY - dragStartPos.y;

        let { xmin, xmax, ymin, ymax } = initialBoxState;

        if (resizeHandle === "tl") {
          xmin = Math.max(0, Math.min(xmax - 0.02, xmin + deltaX));
          ymin = Math.max(0, Math.min(ymax - 0.02, ymin + deltaY));
        } else if (resizeHandle === "tr") {
          xmax = Math.min(1, Math.max(xmin + 0.02, xmax + deltaX));
          ymin = Math.max(0, Math.min(ymax - 0.02, ymin + deltaY));
        } else if (resizeHandle === "bl") {
          xmin = Math.max(0, Math.min(xmax - 0.02, xmin + deltaX));
          ymax = Math.min(1, Math.max(ymin + 0.02, ymax + deltaY));
        } else if (resizeHandle === "br") {
          xmax = Math.min(1, Math.max(xmin + 0.02, xmax + deltaX));
          ymax = Math.min(1, Math.max(ymin + 0.02, ymax + deltaY));
        }

        updateBoxCoord(initialBoxState.id, {
          xmin: Number(xmin.toFixed(3)),
          xmax: Number(xmax.toFixed(3)),
          ymin: Number(ymin.toFixed(3)),
          ymax: Number(ymax.toFixed(3)),
        });
      }
    };

    const onWindowMouseUp = (e: MouseEvent) => {
      if (interactionMode === "drawing" && drawStart && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const xmin = Math.min(drawStart.x, x);
        const xmax = Math.max(drawStart.x, x);
        const ymin = Math.min(drawStart.y, y);
        const ymax = Math.max(drawStart.y, y);

        // Only create if drag was big enough (> 3% area)
        if (xmax - xmin > 0.03 && ymax - ymin > 0.03) {
          const newBox: WatermarkBox = {
            id: `custom-${Date.now()}`,
            xmin: Number(xmin.toFixed(3)),
            ymin: Number(ymin.toFixed(3)),
            xmax: Number(xmax.toFixed(3)),
            ymax: Number(ymax.toFixed(3)),
            label: `Zone personnalisée ${boxes.length + 1}`,
            confidence: 1.0,
            type: "custom",
          };
          onChangeBoxes([...boxes, newBox]);
          setSelectedBoxId(newBox.id);
        }
      }

      setInteractionMode("none");
      setIsDrawing(false);
      setDrawStart(null);
      setDragStartPos(null);
      setInitialBoxState(null);
      setResizeHandle(null);
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
    };
  }, [interactionMode, dragStartPos, initialBoxState, resizeHandle, drawStart, boxes]);

  const updateBoxCoord = (id: string, updates: Partial<WatermarkBox>) => {
    onChangeBoxes(
      boxes.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const nudgeCoord = (coord: "xmin" | "xmax" | "ymin" | "ymax", delta: number) => {
    if (!selectedBox) return;
    let val = selectedBox[coord] + delta;
    val = Math.max(0, Math.min(1, Number(val.toFixed(3))));

    if (coord === "xmin" && val >= selectedBox.xmax) val = selectedBox.xmax - 0.02;
    if (coord === "xmax" && val <= selectedBox.xmin) val = selectedBox.xmin + 0.02;
    if (coord === "ymin" && val >= selectedBox.ymax) val = selectedBox.ymax - 0.02;
    if (coord === "ymax" && val <= selectedBox.ymin) val = selectedBox.ymin + 0.02;

    updateBoxCoord(selectedBox.id, { [coord]: val });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <ScanEye className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Détection de la zone de filigrane
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Ajustez la zone pour qu'elle englobe précisément le filigrane sans déborder.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {boxes.length > 0 && (
            <div className="flex items-center gap-1.5 bg-neutral-800/80 p-1 rounded-lg border border-neutral-700/60">
              <button
                id="btn-shrink-zone-top"
                onClick={() => handleShrinkSelected(0.15)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-mono font-semibold transition-all active:scale-95"
                title="Réduire la taille de la zone (-15%)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Réduire la zone (-15%)</span>
              </button>
              <button
                id="btn-expand-zone-top"
                onClick={() => handleExpandSelected(0.15)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-neutral-700/60 text-neutral-300 text-xs font-mono transition-all active:scale-95"
                title="Agrandir la zone (+15%)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>+15%</span>
              </button>
            </div>
          )}

          {selectedBox && (
            <button
              id="btn-delete-selected-top"
              onClick={() => handleDeleteBox(selectedBox.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 text-xs font-mono font-semibold border border-red-500/30 transition-all active:scale-95 shadow-sm"
              title={`Supprimer la zone sélectionnée (${selectedBox.label})`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer zone</span>
            </button>
          )}

          <button
            id="btn-ai-detect-zone"
            onClick={onDetectAuto}
            disabled={isDetecting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-800 text-white text-xs font-mono font-semibold tracking-wide shadow-md shadow-purple-600/20 transition-all active:scale-95"
          >
            {isDetecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyse en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-détection IA</span>
              </>
            )}
          </button>

          <button
            id="btn-proceed-mask"
            onClick={onProceed}
            disabled={boxes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 text-xs font-mono font-bold uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <span>Générer masque OpenCV</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Image Canvas Display */}
        <div className="lg:col-span-2 flex flex-col items-center">
          <div
            ref={containerRef}
            id="detector-canvas-container"
            onMouseDown={handleMouseDownContainer}
            className="relative select-none rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950 shadow-2xl max-w-full cursor-crosshair group"
            style={{ maxHeight: "560px" }}
          >
            <img
              src={image.src}
              alt="Watermark target"
              className="max-h-[560px] object-contain block pointer-events-none"
              draggable={false}
            />

            {/* Render detected/selected watermark bounding boxes */}
            {boxes.map((box) => {
              const isSelected = box.id === selectedBoxId;
              const left = `${box.xmin * 100}%`;
              const top = `${box.ymin * 100}%`;
              const width = `${(box.xmax - box.xmin) * 100}%`;
              const height = `${(box.ymax - box.ymin) * 100}%`;
              const isNearTop = box.ymin < 0.1;

              return (
                <div
                  key={box.id}
                  onMouseDown={(e) => handleBoxMouseDown(e, box)}
                  className={`absolute transition-none cursor-move select-none ${
                    isSelected
                      ? "border-2 border-amber-400 bg-amber-500/25 shadow-lg shadow-amber-500/30 ring-1 ring-amber-400/40"
                      : "border-2 border-dashed border-red-500/80 bg-red-500/10 hover:border-amber-400"
                  }`}
                  style={{ left, top, width, height }}
                >
                  {/* Badge & Quick resize -15 / +15 on top of the zone text */}
                  <div
                    className={`absolute left-0 pointer-events-auto flex flex-col items-start gap-1 z-30 ${
                      isNearTop ? "top-1 left-1" : "-top-12 left-0"
                    }`}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {/* -15 and +15 directly on top of the text displaying the zone */}
                    {isSelected && (
                      <div className="flex items-center gap-1 bg-neutral-950/95 border border-amber-400/90 rounded-md px-1.5 py-0.5 shadow-xl backdrop-blur-md">
                        <button
                          id={`btn-shrink-top-${box.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShrinkSelected(0.15);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-all active:scale-95 flex items-center gap-0.5"
                          title="Réduire la zone (-15%)"
                        >
                          <Minus className="w-2.5 h-2.5 stroke-[3]" />
                          <span>-15%</span>
                        </button>
                        <button
                          id={`btn-expand-top-${box.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExpandSelected(0.15);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-all active:scale-95 flex items-center gap-0.5 border border-neutral-700"
                          title="Agrandir la zone (+15%)"
                        >
                          <Plus className="w-2.5 h-2.5 stroke-[3]" />
                          <span>+15%</span>
                        </button>
                        <div className="w-px h-3 bg-neutral-700 mx-0.5" />
                        <button
                          id={`btn-delete-canvas-${box.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBox(box.id);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-600/90 hover:bg-red-500 text-white transition-all active:scale-95 flex items-center gap-0.5"
                          title="Supprimer cette zone active"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    )}

                    {/* Text that displays the zone */}
                    <div
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap flex items-center gap-1 shadow cursor-move ${
                        isSelected
                          ? "bg-amber-400 text-neutral-950"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      <span>{box.label}</span>
                      {box.confidence && (
                        <span className="opacity-80">
                          ({Math.round(box.confidence * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corner handles if selected */}
                  {isSelected && (
                    <>
                      {/* Top-Left */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, box, "tl")}
                        className="absolute -top-2 -left-2 w-4 h-4 bg-amber-400 hover:bg-amber-300 border-2 border-neutral-950 rounded-sm cursor-nwse-resize z-40"
                        title="Redimensionner coin haut-gauche"
                      />
                      {/* Top-Right */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, box, "tr")}
                        className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400 hover:bg-amber-300 border-2 border-neutral-950 rounded-sm cursor-nesw-resize z-40"
                        title="Redimensionner coin haut-droit"
                      />
                      {/* Bottom-Left */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, box, "bl")}
                        className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-400 hover:bg-amber-300 border-2 border-neutral-950 rounded-sm cursor-nesw-resize z-40"
                        title="Redimensionner coin bas-gauche"
                      />
                      {/* Bottom-Right */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, box, "br")}
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-400 hover:bg-amber-300 border-2 border-neutral-950 rounded-sm cursor-nwse-resize z-40"
                        title="Redimensionner coin bas-droit"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-neutral-400 mt-2 font-mono flex flex-wrap items-center justify-center gap-2">
            <span>Astuce : <strong>Glissez la zone avec la souris</strong> pour la déplacer, tirez ses 4 poignées pour la redimensionner, ou tracez une nouvelle zone.</span>
            {detectionSource && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                detectionSource === "nvidia-nemotron"
                  ? "bg-green-500/15 text-green-300 border-green-500/30"
                  : detectionSource === "gemini-3.8-flash"
                  ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700"
              }`}>
                IA : {detectionSource === "nvidia-nemotron" ? "NVIDIA Nemotron-3" : detectionSource}
              </span>
            )}
          </div>
        </div>

        {/* Sidebar Controls & Presets */}
        <div className="space-y-4">
          {/* Active Box Coordinates & Fine-tuning */}
          {selectedBox ? (
            <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 space-y-4">
              {/* Affichage -15% et +15% en haut du texte qui affiche la zone */}
              <div className="flex items-center justify-between bg-neutral-950/80 px-3 py-1.5 rounded-lg border border-neutral-800">
                <span className="text-[11px] font-mono text-neutral-400 font-medium">
                  Ajuster taille :
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-sidebar-shrink-15"
                    onClick={() => handleShrinkSelected(0.15)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 text-neutral-950 hover:bg-amber-400 text-xs font-mono font-bold shadow-sm transition-all active:scale-95"
                    title="Réduire la zone (-15%)"
                  >
                    <Minus className="w-3 h-3 stroke-[3]" />
                    <span>-15%</span>
                  </button>
                  <button
                    id="btn-sidebar-expand-15"
                    onClick={() => handleExpandSelected(0.15)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-bold border border-neutral-700 transition-all active:scale-95"
                    title="Agrandir la zone (+15%)"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>+15%</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                  Zone active : {selectedBox.label}
                </span>
                <button
                  id="btn-delete-selected-box"
                  onClick={() => handleDeleteBox(selectedBox.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors"
                  title="Supprimer cette zone"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quick resize buttons */}
              <div className="bg-neutral-950/70 p-2.5 rounded-lg border border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-300">
                  <span className="font-semibold">Ajustement rapide de la taille</span>
                  <span className="text-amber-400 font-bold">
                    {Math.round((selectedBox.xmax - selectedBox.xmin) * 100)}% &times; {Math.round((selectedBox.ymax - selectedBox.ymin) * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    id="btn-shrink-20"
                    onClick={() => handleShrinkSelected(0.20)}
                    className="px-2 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-mono font-bold text-center border border-amber-500/30 transition-all active:scale-95"
                    title="Réduire de 20%"
                  >
                    -20%
                  </button>
                  <button
                    id="btn-shrink-15-grid"
                    onClick={() => handleShrinkSelected(0.15)}
                    className="px-2 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-mono font-bold text-center border border-amber-500/30 transition-all active:scale-95"
                    title="Réduire de 15%"
                  >
                    -15%
                  </button>
                  <button
                    id="btn-expand-15-grid"
                    onClick={() => handleExpandSelected(0.15)}
                    className="px-2 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono font-semibold text-center border border-neutral-700 transition-all active:scale-95"
                    title="Agrandir de 15%"
                  >
                    +15%
                  </button>
                  <button
                    id="btn-expand-20"
                    onClick={() => handleExpandSelected(0.20)}
                    className="px-2 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono font-semibold text-center border border-neutral-700 transition-all active:scale-95"
                    title="Agrandir de 20%"
                  >
                    +20%
                  </button>
                </div>
              </div>

              {/* Fine-tuning Sliders with Nudge buttons */}
              <div className="space-y-3 text-xs font-mono">
                {/* Horizontal X coordinates */}
                <div>
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span>X Min: {Math.round(selectedBox.xmin * 100)}%</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => nudgeCoord("xmin", -0.02)}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                        title="Élargir vers la gauche"
                      >
                        -2%
                      </button>
                      <button
                        onClick={() => nudgeCoord("xmin", +0.02)}
                        className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold"
                        title="Réduire depuis la gauche"
                      >
                        +2%
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={Math.round(selectedBox.xmin * 100)}
                    onChange={(e) =>
                      updateBoxCoord(selectedBox.id, {
                        xmin: Number(e.target.value) / 100,
                      })
                    }
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span>X Max: {Math.round(selectedBox.xmax * 100)}%</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => nudgeCoord("xmax", -0.02)}
                        className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold"
                        title="Réduire depuis la droite"
                      >
                        -2%
                      </button>
                      <button
                        onClick={() => nudgeCoord("xmax", +0.02)}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                        title="Élargir vers la droite"
                      >
                        +2%
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round(selectedBox.xmax * 100)}
                    onChange={(e) =>
                      updateBoxCoord(selectedBox.id, {
                        xmax: Math.max(selectedBox.xmin + 0.04, Number(e.target.value) / 100),
                      })
                    }
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Vertical Y coordinates */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span>Y Min: {Math.round(selectedBox.ymin * 100)}%</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => nudgeCoord("ymin", -0.02)}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                        title="Élargir vers le haut"
                      >
                        -2%
                      </button>
                      <button
                        onClick={() => nudgeCoord("ymin", +0.02)}
                        className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold"
                        title="Réduire depuis le haut"
                      >
                        +2%
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={Math.round(selectedBox.ymin * 100)}
                    onChange={(e) =>
                      updateBoxCoord(selectedBox.id, {
                        ymin: Number(e.target.value) / 100,
                      })
                    }
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span>Y Max: {Math.round(selectedBox.ymax * 100)}%</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => nudgeCoord("ymax", -0.02)}
                        className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold"
                        title="Réduire depuis le bas"
                      >
                        -2%
                      </button>
                      <button
                        onClick={() => nudgeCoord("ymax", +0.02)}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px]"
                        title="Élargir vers le bas"
                      >
                        +2%
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round(selectedBox.ymax * 100)}
                    onChange={(e) =>
                      updateBoxCoord(selectedBox.id, {
                        ymax: Math.max(selectedBox.ymin + 0.04, Number(e.target.value) / 100),
                      })
                    }
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Bouton de suppression de la zone active */}
                <div className="pt-2 border-t border-neutral-800">
                  <button
                    id="btn-remove-active-zone-bottom"
                    onClick={() => handleDeleteBox(selectedBox.id)}
                    className="w-full py-2 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/30 text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                    title="Supprimer la zone sélectionnée"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer la zone sélectionnée ({selectedBox.label})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-900/60 p-6 rounded-xl border border-neutral-800 text-center text-xs font-mono text-neutral-500">
              Aucune zone de filigrane sélectionnée. Cliquez sur un préréglage ou tracez-en une sur le canevas.
            </div>
          )}

          {/* Ratio Format Selector (1:1, 16:9, 9:16) */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-1.5">
                <span>Format d'image / Ratio</span>
              </h4>
              <span className="text-[11px] font-mono font-bold text-amber-400">
                {activeRatio}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono leading-relaxed">
              Adapte instantanément la zone compacte Bas-Droite aux proportions de votre image :
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                id="btn-ratio-1-1"
                onClick={() => handleApplyRatioPreset("1:1")}
                className={`py-2 px-2 text-xs font-mono rounded-lg border text-center transition-all active:scale-95 flex flex-col items-center gap-1 ${
                  activeRatio === "1:1"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700"
                }`}
              >
                <span className="font-bold">1:1 Carré</span>
                <span className="text-[10px] text-neutral-400">10% &times; 4%</span>
              </button>

              <button
                id="btn-ratio-16-9"
                onClick={() => handleApplyRatioPreset("16:9")}
                className={`py-2 px-2 text-xs font-mono rounded-lg border text-center transition-all active:scale-95 flex flex-col items-center gap-1 ${
                  activeRatio === "16:9"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700"
                }`}
              >
                <span className="font-bold">16:9 Paysage</span>
                <span className="text-[10px] text-neutral-400">10% &times; 6%</span>
              </button>

              <button
                id="btn-ratio-9-16"
                onClick={() => handleApplyRatioPreset("9:16")}
                className={`py-2 px-2 text-xs font-mono rounded-lg border text-center transition-all active:scale-95 flex flex-col items-center gap-1 ${
                  activeRatio === "9:16"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700"
                }`}
              >
                <span className="font-bold">9:16 Story</span>
                <span className="text-[10px] text-neutral-400">12% &times; 2%</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono mb-3">
              Préréglages de zones compactes
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="preset-btn-br"
                onClick={() => handleAddPreset("bottom-right")}
                className="px-3 py-2 text-xs font-mono rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-left transition-colors flex items-center justify-between"
              >
                <span>Bas-Droite</span>
                <span className="text-[10px] text-amber-400 font-bold">1:1</span>
              </button>
              <button
                id="preset-btn-bl"
                onClick={() => handleAddPreset("bottom-left")}
                className="px-3 py-2 text-xs font-mono rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-left transition-colors"
              >
                Bas-Gauche
              </button>
              <button
                id="preset-btn-tr"
                onClick={() => handleAddPreset("top-right")}
                className="px-3 py-2 text-xs font-mono rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-left transition-colors"
              >
                Haut-Droite
              </button>
              <button
                id="preset-btn-center"
                onClick={() => handleAddPreset("center")}
                className="px-3 py-2 text-xs font-mono rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-left transition-colors"
              >
                Centre
              </button>
              <button
                id="preset-btn-bottom-banner"
                onClick={() => handleAddPreset("bottom-banner")}
                className="col-span-2 px-3 py-2 text-xs font-mono rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-left transition-colors"
              >
                Bannière bas de page
              </button>
            </div>
          </div>

          {/* List of active zones */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">
                Zones actives ({boxes.length})
              </span>
              {boxes.length > 0 && (
                <button
                  id="btn-clear-all-zones"
                  onClick={() => {
                    onChangeBoxes([]);
                    setSelectedBoxId(null);
                  }}
                  className="text-[11px] text-neutral-400 hover:text-red-400 font-mono underline transition-colors"
                >
                  Tout effacer
                </button>
              )}
            </div>

            {boxes.length === 0 ? (
              <p className="text-xs text-neutral-500 font-mono italic py-2">
                Aucune zone active définie.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {boxes.map((b) => {
                  const isCurrent = b.id === selectedBoxId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBoxId(b.id)}
                      className={`group flex items-center justify-between p-2 rounded-lg text-xs font-mono cursor-pointer transition-all ${
                        isCurrent
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm"
                          : "bg-neutral-800/60 text-neutral-300 hover:bg-neutral-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isCurrent ? "bg-amber-400" : "bg-neutral-500"
                          }`}
                        />
                        <span className="truncate font-medium">{b.label}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-neutral-400">
                          {Math.round((b.xmax - b.xmin) * 100)}% &times; {Math.round((b.ymax - b.ymin) * 100)}%
                        </span>
                        <button
                          id={`btn-remove-zone-item-${b.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBox(b.id);
                          }}
                          className="p-1 rounded text-neutral-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                          title={`Supprimer la zone ${b.label}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
