export default function handler(_req: any, res: any) {
  res.status(200).json({
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
}
