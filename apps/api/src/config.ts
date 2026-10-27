import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .url()
    .refine(
      (v) => /^postgres(ql)?:/.test(v),
      "Use a PostgreSQL connection URL",
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SESSION_HOURS: z.coerce.number().positive().max(168).default(12),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success)
  throw new Error(
    `Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
  );
export const config = parsed.data;
if (
  config.NODE_ENV === "production" &&
  !config.APP_ORIGIN.startsWith("https://")
)
  throw new Error("APP_ORIGIN must use HTTPS in production");
export const production = config.NODE_ENV === "production";
if (new URL(config.APP_ORIGIN).origin !== config.APP_ORIGIN)
  throw new Error(
    "APP_ORIGIN must be an exact origin without a path or trailing slash",
  );
if (
  production &&
  (!config.CLOUDINARY_CLOUD_NAME ||
    !config.CLOUDINARY_API_KEY ||
    !config.CLOUDINARY_API_SECRET)
)
  throw new Error(
    "Production requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET",
  );
