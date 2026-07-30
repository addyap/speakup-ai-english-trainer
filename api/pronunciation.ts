import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { openai } from "./_lib/openai.js";
import { checkRateLimit } from "./_lib/rateLimit.js";

// Pronunciation feedback for a speaking trainer. The client records a voice
// clip, converts it to WAV (the audio model accepts wav/mp3, not webm), and
// posts it here. gpt-4o-audio-preview listens to the audio and returns brief,
// encouraging spoken-pronunciation feedback — NOT grammar.

const BodySchema = z.object({
  audio: z.string().min(200).max(8_000_000), // base64
  format: z.enum(["wav", "mp3"]).optional().default("wav"),
  feedbackLanguage: z.string().max(40).optional().default("English"),
});

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
  const { audio, format, feedbackLanguage } = parsed.data;

  const systemPrompt = `You are a warm English pronunciation coach. You will hear a short clip of a learner speaking English. Assess ONLY pronunciation and delivery — clarity, individual sounds, word stress, sentence rhythm and intonation. Do NOT comment on grammar, vocabulary or content. Be specific but encouraging.
Return ONLY this JSON (no markdown):
{"overall":"1 short encouraging sentence on how clear they sound (in ${feedbackLanguage})","tips":["specific tip on a sound/stress/rhythm to improve (in ${feedbackLanguage})","a second tip (in ${feedbackLanguage})"],"strength":"1 thing they did well (in ${feedbackLanguage})"}
Rules: max 2 tips, each naming a concrete sound or word where helpful (keep example words in English). If the audio is unclear or too short to judge, say so kindly in "overall" and return empty tips.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text"],
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
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
    const p = JSON.parse(raw) as { overall?: string; tips?: unknown; strength?: string };
    res.status(200).json({
      overall: typeof p.overall === "string" ? p.overall : "",
      tips: Array.isArray(p.tips) ? (p.tips as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 2) : [],
      strength: typeof p.strength === "string" ? p.strength : "",
    });
  } catch (err) {
    console.error("[pronunciation] failed:", err);
    res.status(502).json({ error: "Pronunciation feedback unavailable" });
  }
}
