import "../apps/api/environment.mjs";
import pg from "pg";
import { postgresRuntimeUrl } from "../apps/api/src/postgres.ts";

const runtime = new URL(process.env.DATABASE_URL);
const direct = new URL(
  process.env.DIRECT_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL,
);
const client = new pg.Client({
  connectionString: postgresRuntimeUrl(direct.toString()),
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  const tables = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  const ssl = await client.query(
    "select ssl from pg_stat_ssl where pid=pg_backend_pid()",
  );
  // Neon terminates client TLS at its proxy; pg_stat_ssl describes the inner connection.
  console.log(
    JSON.stringify(
      {
        pooledRuntime: runtime.hostname.includes("-pooler"),
        directMigration: !direct.hostname.includes("-pooler"),
        transportTls: client.connection.stream.encrypted === true,
        certificateVerified: client.connection.stream.authorized === true,
        postgresBackendTls: ssl.rows[0]?.ssl === true,
        publicTables: tables.rows.map((row) => row.tablename),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ errorCode: error.code ?? error.name }));
  process.exitCode = 1;
} finally {
  await client.end();
}
