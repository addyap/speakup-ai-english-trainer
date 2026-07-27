import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hintHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return hintHandler(req as Parameters<typeof hintHandler>[0], res as Parameters<typeof hintHandler>[1]);
}
