import type { VercelRequest, VercelResponse } from "@vercel/node";
import { feedbackHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return feedbackHandler(req as Parameters<typeof feedbackHandler>[0], res as Parameters<typeof feedbackHandler>[1]);
}
