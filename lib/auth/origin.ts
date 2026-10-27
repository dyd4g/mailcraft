/**
 * The address people use to reach the app. Set PUBLIC_BASE_URL in production (for example https://mailcraft.example.com);
 * without it the proxy's forwarded headers are used, then the request's own address.
 */
export function publicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    try { return new URL(configured).origin; } catch { /* fall through to the request */ }
  }
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}
/** Absolute public address for a path such as /r/<token>. */
export const publicUrl = (req: Request, path: string) => new URL(path, publicOrigin(req)).href;
