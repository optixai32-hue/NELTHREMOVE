import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase payload limit for high-resolution images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    activeModel: process.env.NVIDIA_API_KEY
      ? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
      : process.env.GEMINI_API_KEY
      ? "gemini-3.8-flash"
      : "heuristic",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Call NVIDIA AI Endpoints (nemotron-3-nano-omni-30b-a3b-reasoning)
 * Equivalent to ChatNVIDIA in langchain_nvidia_ai_endpoints:
 * model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
 * temperature=0.6, top_p=0.95, max_completion_tokens=65536
 */
async function callNvidiaNemotron(imageBase64Url: string, promptText: string) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }

  const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";

  const lcMessages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: promptText,
        },
        {
          type: "image_url",
          image_url: {
            url: imageBase64Url,
          },
        },
      ],
    },
  ];

  const payload = {
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    messages: lcMessages,
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 4096,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message || {};
  const content = message.content || "";
  const reasoningContent = message.reasoning_content || choice?.reasoning_content;

  return {
    content,
    reasoningContent,
  };
}

// Watermark Detection API using NVIDIA Nemotron-3 (with Gemini & heuristic fallbacks)
app.post("/api/detect-watermark", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    const fullDataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const prompt = `Analyze this image carefully to detect any watermarks, logos, timestamps, copyright notices, stock photo markers, or text overlays that need to be inpainted/removed.
IMPORTANT: Keep the bounding box tight and compact around the watermark text or logo itself. Avoid overly large boxes that capture unrelated background imagery.
Return ONLY valid JSON matching this schema:
{
  "watermarks": [
    {
      "box": {
        "ymin": number (0.0 to 1.0),
        "xmin": number (0.0 to 1.0),
        "ymax": number (0.0 to 1.0),
        "xmax": number (0.0 to 1.0)
      },
      "label": string (e.g. "Stock Photo Watermark", "Timestamp Overlay", "Copyright Text", "Corner Logo"),
      "confidence": number (0.0 to 1.0),
      "type": "text" | "logo" | "pattern" | "stamp"
    }
  ]
}
If no watermark is obvious, identify the most likely logo or overlay zone (often bottom-right, bottom-left, or center), or return the most prominent overlay. Return only JSON.`;

    let responseText = "";
    let reasoningContent: string | undefined = undefined;
    let sourceUsed: "nvidia-nemotron" | "gemini-3.8-flash" | "heuristic" = "heuristic";

    // 1. Try NVIDIA Nemotron-3 if NVIDIA_API_KEY is available
    if (process.env.NVIDIA_API_KEY) {
      try {
        const nvidiaRes = await callNvidiaNemotron(fullDataUrl, prompt);
        responseText = nvidiaRes.content;
        reasoningContent = nvidiaRes.reasoningContent;
        sourceUsed = "nvidia-nemotron";
      } catch (nvidiaErr) {
        console.warn("NVIDIA Nemotron call failed, attempting Gemini fallback:", nvidiaErr);
      }
    }

    // 2. Try Gemini 3.8 Flash if NVIDIA didn't succeed or not configured
    if (!responseText) {
      const ai = getGeminiClient();
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      data: cleanBase64,
                      mimeType,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });
          responseText = response.text || "";
          sourceUsed = "gemini-3.8-flash";
        } catch (geminiErr) {
          console.warn("Gemini call failed:", geminiErr);
        }
      }
    }

    // 3. If neither LLM returned a response, use heuristic fallback
    if (!responseText) {
      return res.json({
        success: true,
        source: "heuristic",
        watermarks: [
          {
            box: { ymin: 0.94, xmin: 0.87, ymax: 0.98, xmax: 0.97 },
            label: "Bottom-Right Watermark",
            confidence: 0.85,
            type: "logo_or_text",
          },
        ],
        message: "Neither NVIDIA nor Gemini API keys returned a result; using heuristic detection.",
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Clean up markdown codeblocks if any
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
      }
    }

    const watermarks = Array.isArray(parsed.watermarks) ? parsed.watermarks : [];

    // Ensure valid coordinates
    const normalizedWatermarks = watermarks.map((w: any, index: number) => {
      const box = w.box || {};
      return {
        id: `wm-${index + 1}`,
        box: {
          ymin: Math.max(0, Math.min(1, Number(box.ymin ?? 0.8))),
          xmin: Math.max(0, Math.min(1, Number(box.xmin ?? 0.7))),
          ymax: Math.max(0, Math.min(1, Number(box.ymax ?? 0.95))),
          xmax: Math.max(0, Math.min(1, Number(box.xmax ?? 0.98))),
        },
        label: w.label || `Detected Watermark ${index + 1}`,
        confidence: Number(w.confidence ?? 0.9),
        type: w.type || "text",
      };
    });

    if (normalizedWatermarks.length === 0) {
      // Provide standard corner default if none detected
      normalizedWatermarks.push({
        id: "wm-default",
        box: { ymin: 0.94, xmin: 0.87, ymax: 0.98, xmax: 0.97 },
        label: "Bottom-Right Watermark",
        confidence: 0.75,
        type: "logo",
      });
    }

    return res.json({
      success: true,
      source: sourceUsed,
      reasoningContent,
      watermarks: normalizedWatermarks,
    });
  } catch (err: any) {
    console.error("Watermark detection error:", err);
    // Graceful fallback so user is never blocked
    return res.json({
      success: true,
      source: "fallback",
      error: err.message,
      watermarks: [
        {
          id: "wm-fallback",
          box: { ymin: 0.94, xmin: 0.87, ymax: 0.98, xmax: 0.97 },
          label: "Bottom-Right Watermark",
          confidence: 0.8,
          type: "text",
        },
      ],
    });
  }
});

// Vite Middleware & Static Serving Setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nelth-IA Watermark Inpainter server running on http://localhost:${PORT}`);
  });
}

startServer();
