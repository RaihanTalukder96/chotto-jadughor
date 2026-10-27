import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config.js";
import { postgresRuntimeUrl } from "./postgres.js";
export const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: postgresRuntimeUrl(config.DATABASE_URL),
    max: 10,
  }),
});
