import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { openai } from "./_lib/openai.js";
import { checkRateLimit } from "./_lib/rateLimit.js";

// OpenAI text-to-speech — natural coaching voice, replaces the browser's
// robotic Web Speech synthesis. The client (lib/tts.ts) calls this and falls
// back to Web Speech automatically if it is unavailable.

type TtsVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable"
  | "nova" | "onyx" | "sage" | "shimmer" | "verse";

const ALLOWED_VOICES: readonly TtsVoice[] = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "nova", "onyx", "sage", "shimmer", "verse",
];
const DEFAULT_VOICE: TtsVoice = "alloy";

const BodySchema = z.object({
  text: z.string().min(1).max(1200),
  accent: z.enum(["auto", "british", "american"]).optional(),
  slow: z.boolean().optional(),
  voice: z.string().optional(),
});

function instructionFor(accent: string | undefined, slow: boolean | undefined): string {
  const acc =
    accent === "british"
      ? "Use a natural British English accent."
      : accent === "american"
      ? "Use a natural American English accent."
      : "Use clear, neutral English.";
  const pace = slow
    ? "Speak slowly and very clearly, as if helping a language learner catch every word."
    : "Speak at a relaxed, natural conversational pace.";
  return `You are a warm, encouraging English conversation coach. ${acc} ${pace} Sound human and friendly, never robotic or flat.`;
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
  const { text, accent, slow, voice } = parsed.data;
  const chosen: TtsVoice =
    voice && (ALLOWED_VOICES as readonly string[]).includes(voice)
      ? (voice as TtsVoice)
      : DEFAULT_VOICE;

  try {
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: chosen,
      input: text,
      instructions: instructionFor(accent, slow),
      response_format: "mp3",
    });
    const buf = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(buf);
  } catch (err) {
    console.error("[tts] generation failed:", err);
    res.status(502).json({ error: "TTS unavailable" });
  }
}
