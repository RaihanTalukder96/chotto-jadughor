import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  postgresRuntimeUrl,
  isLocalDemoDatabase,
} from "../apps/api/src/postgres.js";
it("keeps explicit certificate verification on Neon without modifying local connections", () => {
  expect(
    new URL(
      postgresRuntimeUrl(
        "postgresql://example:example@ep-example-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require&channel_binding=require",
      ),
    ).searchParams.get("sslmode"),
  ).toBe("verify-full");
  expect(
    postgresRuntimeUrl("postgresql://example:example@localhost:5432/db"),
  ).toBe("postgresql://example:example@localhost:5432/db");
  expect(
    new URL(
      postgresRuntimeUrl(
        "postgresql://example:example@ep-example.aws.neon.tech/db?sslmode=verify-full",
      ),
    ).searchParams.get("sslmode"),
  ).toBe("verify-full");
});
it("never allows demo credentials on a remote Neon database", () => {
  expect(
    isLocalDemoDatabase("postgresql://example:example@localhost:5432/db"),
  ).toBe(true);
  expect(
    isLocalDemoDatabase("postgresql://example:example@127.0.0.1:5432/db"),
  ).toBe(true);
  expect(
    isLocalDemoDatabase(
      "postgresql://example:example@ep-example-pooler.aws.neon.tech/db",
    ),
  ).toBe(false);
});
it("keeps an explicit CI database override away from the linked production migration URL", () => {
  const local = "postgresql://test:test@127.0.0.1:55432/test";
  const env = { ...process.env, DATABASE_URL: local };
  delete env.DIRECT_URL;
  delete env.DATABASE_URL_UNPOOLED;
  delete env.DOTENV_CONFIG_PATH;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import './apps/api/environment.mjs'; console.log(JSON.stringify({runtime:process.env.DATABASE_URL,direct:process.env.DIRECT_URL}));",
    ],
    { env, encoding: "utf8" },
  );
  expect(child.status).toBe(0);
  expect(JSON.parse(child.stdout)).toEqual({ runtime: local, direct: local });
});
