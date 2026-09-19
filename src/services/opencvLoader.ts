declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

export type OpenCVStatus = "idle" | "loading" | "ready" | "error";

class OpenCVLoader {
  private status: OpenCVStatus = "idle";
  private listeners: ((status: OpenCVStatus) => void)[] = [];
  private loadPromise: Promise<boolean> | null = null;

  getStatus(): OpenCVStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.status === "ready" && typeof window !== "undefined" && Boolean(window.cv && window.cv.Mat);
  }

  subscribe(listener: (status: OpenCVStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }

  async load(): Promise<boolean> {
    if (this.isReady()) {
      return true;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.status = "loading";
    this.notify();

    this.loadPromise = new Promise<boolean>((resolve) => {
      // Check if already in window
      if (window.cv && window.cv.Mat) {
        this.status = "ready";
        this.notify();
        resolve(true);
        return;
      }

      // Setup Module configuration before script loads
      window.Module = {
        onRuntimeInitialized: () => {
          this.status = "ready";
          this.notify();
          resolve(true);
        },
      };

      const cdnUrls = [
        "https://docs.opencv.org/4.8.0/opencv.js",
        "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.2/dist/opencv.js",
      ];

      const tryLoadScript = (index: number) => {
        if (index >= cdnUrls.length) {
          console.warn("OpenCV.js CDN failed to load; using native Fast Marching Telea engine.");
          this.status = "error";
          this.notify();
          resolve(false);
          return;
        }

        const script = document.createElement("script");
        script.setAttribute("async", "true");
        script.setAttribute("type", "text/javascript");
        script.src = cdnUrls[index];

        const timeout = setTimeout(() => {
          console.warn(`Timeout loading OpenCV from ${cdnUrls[index]}, trying fallback...`);
          script.remove();
          tryLoadScript(index + 1);
        }, 8000);

        script.onload = () => {
          clearTimeout(timeout);
          // Some builds trigger onRuntimeInitialized, others initialize synchronously
          if (window.cv && window.cv.Mat) {
            this.status = "ready";
            this.notify();
            resolve(true);
          } else if (window.cv) {
            window.cv["onRuntimeInitialized"] = () => {
              this.status = "ready";
              this.notify();
              resolve(true);
            };
          }
        };

        script.onerror = () => {
          clearTimeout(timeout);
          script.remove();
          tryLoadScript(index + 1);
        };

        document.head.appendChild(script);
      };

      tryLoadScript(0);
    });

    return this.loadPromise;
  }
}

export const openCVLoader = new OpenCVLoader();
