import React, { useRef, useState } from "react";
import { SAMPLE_IMAGES } from "../services/sampleImages";
import { SampleImageItem } from "../types";
import { Upload, Image as ImageIcon, Sparkles, ArrowRight, Check } from "lucide-react";

interface ImageUploaderProps {
  onImageLoaded: (image: HTMLImageElement, fileInfo: { name: string; size?: string }) => void;
  currentImage: HTMLImageElement | null;
  onProceed: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageLoaded,
  currentImage,
  onProceed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + " MB";
        onImageLoaded(img, { name: file.name, size: sizeFormatted });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSampleSelect = async (sample: SampleImageItem) => {
    setLoadingSampleId(sample.id);
    try {
      const dataUrl = await sample.generator();
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        onImageLoaded(img, { name: `${sample.name}.jpg`, size: "640 KB" });
        setLoadingSampleId(null);
      };
      img.src = dataUrl;
    } catch (err) {
      console.error("Failed to load sample image:", err);
      setLoadingSampleId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6">
      {/* Upload Zone */}
      <div
        id="image-drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-8 md:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-amber-400 bg-amber-500/10 scale-[1.01]"
            : currentImage
            ? "border-neutral-700 bg-neutral-900/60 hover:border-neutral-600"
            : "border-neutral-800 bg-neutral-900/40 hover:border-amber-500/50 hover:bg-neutral-900/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {currentImage ? (
          <div className="flex flex-col items-center">
            <div className="relative rounded-xl overflow-hidden border border-neutral-700 shadow-2xl max-h-72 mb-4 bg-neutral-950">
              <img
                src={currentImage.src}
                alt="Source preview"
                className="max-h-72 object-contain"
              />
              <div className="absolute top-2 right-2 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-md text-[11px] font-mono text-neutral-300 border border-white/10">
                {currentImage.naturalWidth} &times; {currentImage.naturalHeight} px
              </div>
            </div>

            <p className="text-sm font-medium text-neutral-200">
              Image loaded & ready for processing
            </p>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Click or drop to replace with another image
            </p>

            <button
              id="btn-proceed-detect"
              onClick={(e) => {
                e.stopPropagation();
                onProceed();
              }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs tracking-wider uppercase font-mono shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <span>Proceed to Watermark Detection</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1 font-sans">
              Drop an image with a watermark to clean
            </h3>
            <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6">
              Supports high-resolution PNG, JPEG, and WebP. Automatically detects watermark boundaries and applies OpenCV Telea inpainting.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-medium border border-neutral-700 transition-colors">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Browse Local Files</span>
            </div>
          </div>
        )}
      </div>

      {/* Preset Test Images */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-neutral-200 uppercase tracking-wider font-mono">
              Or Try Pre-Loaded Watermarked Samples
            </h4>
          </div>
          <span className="text-xs text-neutral-500 font-mono">
            1-Click Instant Load
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SAMPLE_IMAGES.map((sample) => {
            const isLoading = loadingSampleId === sample.id;
            return (
              <div
                key={sample.id}
                id={`sample-card-${sample.id}`}
                onClick={() => handleSampleSelect(sample)}
                className="group relative rounded-xl border border-neutral-800 hover:border-amber-500/50 bg-neutral-900/50 hover:bg-neutral-850 p-3.5 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {sample.category}
                    </span>
                    {isLoading && (
                      <span className="text-[10px] font-mono text-amber-400 animate-pulse">
                        Rendering...
                      </span>
                    )}
                  </div>

                  <h5 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors font-sans mb-1">
                    {sample.name}
                  </h5>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 mb-2">
                    {sample.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 mt-2">
                  <div className="text-[10px] text-amber-400/80 font-mono line-clamp-1">
                    {sample.watermarkDescription}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
