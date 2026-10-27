import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { mountWeb } from "../apps/api/src/web.js";

describe("same-origin React hosting", () => {
  it("serves deep links and immutable assets without swallowing API or missing-asset errors", async () => {
    const temporaryRoot = resolve(process.cwd(), ".local");
    mkdirSync(temporaryRoot, { recursive: true });
    const directory = mkdtempSync(join(temporaryRoot, "web-test-"));
    try {
      writeFileSync(
        join(directory, "index.html"),
        "<!doctype html><title>Store workspace</title>",
      );
      mkdirSync(join(directory, "assets"));
      writeFileSync(
        join(directory, "assets", "index-test.js"),
        'console.log("build");',
      );
      const app = express();
      app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
      mountWeb(app, directory);
      app.use((_req, res) => res.status(404).json({ error: "not found" }));
      expect((await request(app).get("/")).text).toContain("Store workspace");
      expect(
        (await request(app).get("/products").set("Accept", "text/html")).text,
      ).toContain("Store workspace");
      const asset = await request(app).get("/assets/index-test.js");
      expect(asset.status).toBe(200);
      expect(asset.headers["cache-control"]).toContain("immutable");
      expect((await request(app).get("/api/health/live")).body.status).toBe(
        "ok",
      );
      expect((await request(app).get("/api/missing")).status).toBe(404);
      expect((await request(app).get("/assets/missing.js")).status).toBe(404);
      expect((await request(app).post("/products")).status).toBe(404);
    } finally {
      if (dirname(resolve(directory)) !== temporaryRoot)
        throw new Error("Unsafe test cleanup path");
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
