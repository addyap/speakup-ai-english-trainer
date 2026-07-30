import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { toFile } from "openai";
import { openai } from "./_lib/openai.js";
import { checkRateLimit } from "./_lib/rateLimit.js";

// Audio endpoint (one Vercel function to stay within the serverless-function
// limit):
//   task "transcribe" (default) — speech-to-text via OpenAI, replacing the
//     browser's flaky Web Speech recognition. Client posts recorded webm/mp4.
//   task "pronounce" — end-of-session pronunciation feedback via gpt-4o-audio
//     (how the learner SOUNDS: clarity, stress, rhythm — not grammar). Client
//     posts a wav/mp3 clip.

const BodySchema = z.object({
  audio: z.string().min(16).max(8_000_000), // base64
  task: z.enum(["transcribe", "pronounce"]).optional().default("transcribe"),
  mime: z.string().max(80).optional(),
  lang: z.string().max(8).optional(),
  format: z.enum(["wav", "mp3"]).optional().default("wav"),
  feedbackLanguage: z.string().max(40).optional().default("English"),
});

function extFor(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "mp4";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

async function pronounce(
  res: VercelResponse,
  audio: string,
  format: "wav" | "mp3",
  feedbackLanguage: string,
): Promise<void> {
  const systemPrompt = `You are a warm English pronunciation coach. You will hear a short clip of a learner speaking English. Assess ONLY pronunciation and delivery — clarity, individual sounds, word stress, sentence rhythm and intonation. Do NOT comment on grammar, vocabulary or content. Be specific but encouraging.
Return ONLY this JSON (no markdown):
{"overall":"1 short encouraging sentence on how clear they sound (in ${feedbackLanguage})","tips":["specific tip on a sound/stress/rhythm to improve (in ${feedbackLanguage})","a second tip (in ${feedbackLanguage})"],"strength":"1 thing they did well (in ${feedbackLanguage})"}
Rules: max 2 tips, each naming a concrete sound or word where helpful (keep example words in English). If the audio is unclear or too short to judge, say so kindly in "overall" and return empty tips.
IMPORTANT: Output ONLY the raw JSON object — it must start with { and end with }. No greeting, no preamble, no explanation, no markdown fences.`;
  try {
    const response = await openai.chat.completions.create({
      // Audio-input chat model (successor to the retired gpt-4o-audio-preview).
      // Requires org verification; if unavailable the client hides the card.
      model: "gpt-audio",
      modalities: ["text"],
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Here is my English speaking clip. How is my pronunciation?" },
            { type: "input_audio", input_audio: { data: audio, format } },
          ],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      res.status(502).json({ error: "Empty response" });
      return;
    }
    // gpt-audio doesn't support forced JSON mode and occasionally answers in
    // prose. Try to parse the JSON object; if that fails, degrade gracefully by
    // surfacing the model's prose as the overall comment rather than erroring.
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    let parsed: { overall?: string; tips?: unknown; strength?: string } | null = null;
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
    }
    if (parsed) {
      res.status(200).json({
        overall: typeof parsed.overall === "string" ? parsed.overall : "",
        tips: Array.isArray(parsed.tips) ? (parsed.tips as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 2) : [],
        strength: typeof parsed.strength === "string" ? parsed.strength : "",
      });
    } else {
      res.status(200).json({ overall: cleaned.slice(0, 300), tips: [], strength: "" });
    }
  } catch (err) {
    console.error("[pronounce] failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "Pronunciation feedback unavailable", detail: detail.slice(0, 500) });
  }
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
  const { audio, task, mime, lang, format, feedbackLanguage } = parsed.data;

  if (task === "pronounce") {
    await pronounce(res, audio, format, feedbackLanguage);
    return;
  }

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
