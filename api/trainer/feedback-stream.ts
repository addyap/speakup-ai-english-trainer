import type { VercelRequest, VercelResponse } from "@vercel/node";
import { feedbackStreamHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return feedbackStreamHandler(req as Parameters<typeof feedbackStreamHandler>[0], res as Parameters<typeof feedbackStreamHandler>[1]);
}
