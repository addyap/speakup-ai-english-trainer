// Unified OpenAI client.
// On Replit  → uses the AI integration proxy env vars automatically injected by Replit.
// On Vercel  → falls back to the standard OPENAI_API_KEY against api.openai.com.
// On local dev → same fallback, set OPENAI_API_KEY in .env.local.

import OpenAI from "openai";

const apiKey =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
  process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "No OpenAI API key found. " +
    "Set OPENAI_API_KEY (or AI_INTEGRATIONS_OPENAI_API_KEY on Replit).",
  );
}

export const openai = new OpenAI({
  apiKey,
  ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL }
    : {}),
});
