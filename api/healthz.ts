import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  // TEMP diagnostic (?diag=ip): confirm what IP-identifying data Vercel
  // actually hands the function, to debug a suspected rate-limit collapse.
  if (req.query.diag === "ip") {
    res.json({
      xRealIp: req.headers["x-real-ip"] ?? null,
      xForwardedFor: req.headers["x-forwarded-for"] ?? null,
      remoteAddress: req.socket?.remoteAddress ?? null,
    });
    return;
  }
  res.json({ status: "ok" });
}
