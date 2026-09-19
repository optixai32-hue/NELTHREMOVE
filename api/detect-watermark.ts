import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}

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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body || {};
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

    // 3. Fallback heuristic
    if (!responseText) {
      return res.status(200).json({
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
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
      }
    }

    const watermarks = Array.isArray(parsed.watermarks) ? parsed.watermarks : [];

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
      normalizedWatermarks.push({
        id: "wm-default",
        box: { ymin: 0.94, xmin: 0.87, ymax: 0.98, xmax: 0.97 },
        label: "Bottom-Right Watermark",
        confidence: 0.75,
        type: "text",
      });
    }

    return res.status(200).json({
      success: true,
      source: sourceUsed,
      watermarks: normalizedWatermarks,
      reasoning: reasoningContent,
    });
  } catch (error: any) {
    console.error("Detection error:", error);
    return res.status(500).json({
      error: "Internal server error during detection",
      details: error.message,
    });
  }
}
