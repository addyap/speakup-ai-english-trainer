import type { VercelRequest, VercelResponse } from "@vercel/node";
import { translateHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return translateHandler(req as Parameters<typeof translateHandler>[0], res as Parameters<typeof translateHandler>[1]);
}
