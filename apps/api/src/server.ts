import { app, logger } from "./app.js";
import { db } from "./db.js";
import { config } from "./config.js";
import { cleanupAssets } from "./images.js";
const server = app.listen(config.PORT, "0.0.0.0", () =>
  logger.info({ port: config.PORT }, "API listening"),
);
const cleanup = setInterval(() => {
  db.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => logger.warn("Session cleanup failed; will retry"));
  if (config.CLOUDINARY_API_SECRET)
    cleanupAssets().catch(() =>
      logger.warn("Asset cleanup failed; will retry"),
    );
}, 15 * 60000);
cleanup.unref();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(cleanup);
    server.close(() => {
      db.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
