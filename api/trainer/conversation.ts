import type { VercelRequest, VercelResponse } from "@vercel/node";
import { conversationHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return conversationHandler(req as Parameters<typeof conversationHandler>[0], res as Parameters<typeof conversationHandler>[1]);
}
