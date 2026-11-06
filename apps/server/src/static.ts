import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Hono } from "hono";
import { compress } from "hono/compress";

/**
 * Serves the built web app (single image, S11): hashed assets are cached for a year,
 * index.html never, and unknown paths fall back to index.html for client-side routes.
 * Only static files are compressed; SSE streams under /api must stay unbuffered (S9).
 */
export function serveWebApp(app: Hono, distDir: string): boolean {
  const index = join(distDir, "index.html");
  if (!existsSync(index)) return false;

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/") || c.req.path === "/health") return next();
    return compress()(c, next);
  });

  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api/") || c.req.path === "/health") return next();
    const relative = normalize(decodeURIComponent(c.req.path)).replace(/^(\.\.[/\\])+/, "");
    const file = Bun.file(join(distDir, relative));
    if (relative !== "/" && (await file.exists())) {
      const immutable = relative.startsWith("/assets/");
      return new Response(file, {
        headers: {
          "content-type": file.type,
          "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
        },
      });
    }
    return new Response(Bun.file(index), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
    });
  });
  return true;
}
