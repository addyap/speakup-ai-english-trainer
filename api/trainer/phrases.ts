import type { VercelRequest, VercelResponse } from "@vercel/node";
import { phrasesHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return phrasesHandler(req as Parameters<typeof phrasesHandler>[0], res as Parameters<typeof phrasesHandler>[1]);
}
