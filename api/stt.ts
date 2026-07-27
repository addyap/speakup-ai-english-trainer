import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { toFile } from "openai";
import { openai } from "./_lib/openai.js";
import { checkRateLimit } from "./_lib/rateLimit.js";

// Speech-to-text via OpenAI, replacing the browser's flaky Web Speech
// recognition (which streams audio to Google and fails with a "network"
// error on Safari, Brave, restricted networks, etc.). The client records
// audio locally and posts it here as base64 for reliable transcription.

const BodySchema = z.object({
  audio: z.string().min(16).max(8_000_000), // base64, ~6MB cap
  mime: z.string().max(80).optional(),
  lang: z.string().max(8).optional(),
});

function extFor(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "mp4";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rl = checkRateLimit(req.headers, req.socket?.remoteAddress);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    res.status(429).json({ error: "Rate limited" });
    return;
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { audio, mime, lang } = parsed.data;

  try {
    const buf = Buffer.from(audio, "base64");
    if (buf.length < 800) {
      res.status(200).json({ text: "" }); // too short to contain speech
      return;
    }
    const file = await toFile(buf, `speech.${extFor(mime)}`, { type: mime ?? "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-transcribe",
      language: lang || "en",
    });
    res.status(200).json({ text: (transcription.text ?? "").trim() });
  } catch (err) {
    console.error("[stt] transcription failed:", err);
    res.status(502).json({ error: "STT unavailable" });
  }
}
