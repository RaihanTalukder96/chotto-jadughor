import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Optional same-origin deployment: one Node service serves React and /api. */
export function mountWeb(
  app: Express,
  directory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../web/dist",
  ),
) {
  const index = resolve(directory, "index.html");
  if (!existsSync(index))
    throw new Error(
      "Frontend build is missing. Run npm run build before enabling SERVE_WEB.",
    );
  const files = express.static(directory, {
    index: false,
    dotfiles: "deny",
    setHeaders(res, path) {
      res.setHeader(
        "Cache-Control",
        path.includes(`${"assets"}/`) || path.includes("assets\\")
          ? "public, max-age=31536000, immutable"
          : "no-store",
      );
    },
  });
  app.use((req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    files(req, res, next);
  });
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      req.path === "/api" ||
      req.path.startsWith("/api/") ||
      extname(req.path) ||
      !req.accepts("html")
    )
      return next();
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("index.html", { root: directory, dotfiles: "deny" });
  });
}
