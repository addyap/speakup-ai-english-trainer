import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hintStreamHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return hintStreamHandler(req as Parameters<typeof hintStreamHandler>[0], res as Parameters<typeof hintStreamHandler>[1]);
}
