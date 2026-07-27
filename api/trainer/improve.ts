import type { VercelRequest, VercelResponse } from "@vercel/node";
import { improveHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return improveHandler(req as Parameters<typeof improveHandler>[0], res as Parameters<typeof improveHandler>[1]);
}
