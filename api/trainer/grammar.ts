import type { VercelRequest, VercelResponse } from "@vercel/node";
import { grammarHandler } from "./_shared.js";

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return grammarHandler(req as Parameters<typeof grammarHandler>[0], res as Parameters<typeof grammarHandler>[1]);
}
