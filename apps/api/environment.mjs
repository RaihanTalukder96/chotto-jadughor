import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(apiDirectory, "../..");
const suppliedDatabaseUrl = process.env.DATABASE_URL;
const suppliedDirectUrl = process.env.DIRECT_URL;
const suppliedUnpooledUrl = process.env.DATABASE_URL_UNPOOLED;

// Platform/shell variables always win. An explicit file is useful for release jobs.
if (process.env.DOTENV_CONFIG_PATH) {
  config({ path: process.env.DOTENV_CONFIG_PATH, quiet: true });
} else {
  // Neon CLI writes branch-specific credentials here; never expose these as VITE_*.
  config({
    path: [resolve(root, ".env.local"), resolve(root, ".env")],
    quiet: true,
  });
  // An explicit database override (CI/local tests) must not borrow a different
  // branch's migration URL from the checked-out Neon environment file.
  if (suppliedDatabaseUrl && !suppliedDirectUrl && !suppliedUnpooledUrl) {
    process.env.DIRECT_URL = suppliedDatabaseUrl;
    delete process.env.DATABASE_URL_UNPOOLED;
  }
  // Prefer Neon's direct URL over a legacy local-development DIRECT_URL.
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL_UNPOOLED) {
    process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
  }
  config({
    path: [resolve(apiDirectory, ".env.local"), resolve(apiDirectory, ".env")],
    quiet: true,
  });
}
