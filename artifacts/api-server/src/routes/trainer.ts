// Thin Express wrapper — mounts the shared handler functions from /api/trainer/_shared.ts.
// There is ONE implementation of each route (in _shared.ts); this file only wires them
// into the Express router so Replit's persistent-server deployment keeps working.

import { Router } from "express";
import type { RequestHandler } from "express";
import type { AppReq, AppRes } from "../../../../api/trainer/_shared.js";
import {
  conversationHandler,
  feedbackHandler,
  feedbackStreamHandler,
  hintHandler,
  hintStreamHandler,
  improveHandler,
  translateHandler,
} from "../../../../api/trainer/_shared.js";

// Cast is safe: Express Request extends IncomingMessage (satisfies AppReq) and
// Express Response extends ServerResponse (satisfies AppRes). The optional req.log
// property is populated by pino-http before these handlers run.
function wrap(h: (req: AppReq, res: AppRes) => Promise<void>): RequestHandler {
  return (req, res) => h(req as unknown as AppReq, res as unknown as AppRes);
}

const router = Router();

router.post("/conversation",     wrap(conversationHandler));
router.post("/feedback",         wrap(feedbackHandler));
router.post("/feedback-stream",  wrap(feedbackStreamHandler));
router.post("/hint",             wrap(hintHandler));
router.post("/hint-stream",      wrap(hintStreamHandler));
router.post("/improve",          wrap(improveHandler));
router.post("/translate",        wrap(translateHandler));

export default router;
