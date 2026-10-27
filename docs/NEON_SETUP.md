# Neon deployment record

## Applied target

- Organization: `org-fragrant-cell-20019196`
- Project: `cold-mud-71951638` (`chotto-jadughor`)
- Branch: `production` (`br-soft-breeze-b3405ulq`)
- Region: `aws-ap-southeast-1` (Singapore)
- PostgreSQL: 18
- Service: PostgreSQL only. The existing Express session/authentication system and Cloudinary storage remain in use.

Neon reported this project on its Free plan. `neon config plan` and `neon deploy` both reported no infrastructure changes. No paid plan upgrade, extra Neon service, or additional remote project/branch was provisioned.

## CLI and configuration

The requested `npm i -g neon@latest` succeeded. The exact requested init command was attempted:

```sh
neon init -y --org-id org-fragrant-cell-20019196 --project-id cold-mud-71951638 --branch production --services postgres
```

Its editor-plugin installation failed for the detected agents before project initialization finished. Recovery used the same target and PostgreSQL-only service selection with `--no-agent-setup`:

```sh
neon init -y --no-agent-setup --org-id org-fragrant-cell-20019196 --project-id cold-mud-71951638 --branch production --services postgres
neon skills -y --agent codex --skill neon --skill neon-postgres
neon login
neon config plan
neon deploy
```

Browser sign-in completed successfully. The project-local Neon and neon-postgres skills were read. They recommend preserving an established ORM/driver and using pooled connections for app traffic and direct connections for migrations. This app therefore retains Prisma 7, its pg adapter and the persistent Node/Express pool rather than switching database drivers or authentication providers. `@neon/config` and `@neon/env` were installed by the CLI with lockfile updates; `neon.ts` declares PostgreSQL-only configuration. The generated `auth: false` matches the inspected live branch and does not replace application auth.

The CLI output was:

```text
→ Applying to branch production (br-soft-breeze-b3405ulq)
No changes — branch production already matches the policy.
Utilized services: Postgres
Pulled 3 Neon variables into .env.local
  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED
  Branch          NEON_BRANCH
```

`.neon`, `.env.local`, backend environment files and `.local/production-admin.json` are Git-ignored. Private env files are also excluded from Docker build contexts. No passwords, database URLs or API secrets are included in this record.

## Environment loading and connections

`apps/api/environment.mjs` is shared by the API config and Prisma CLI. Platform/shell variables take precedence. With no explicit `DOTENV_CONFIG_PATH`, it loads the root `.env.local`/`.env` first, maps Neon's direct URL to `DIRECT_URL`, and then loads backend local env files for Cloudinary and other settings without overwriting existing variables. A caller-provided `DATABASE_URL` without a companion direct URL is kept as that caller's migration target, preventing a local test database override from accidentally borrowing the linked production migration URL. Set both connection URLs explicitly when supplying a pooled runtime URL for deployment.

`DOTENV_CONFIG_PATH` selects one explicit private file when needed. It is a file path resolved from the current command's working directory. No secret is exposed through `VITE_` variables.

The API uses pooled `DATABASE_URL` through PrismaPg with a maximum of 10 pg connections per process. Migrations use `DIRECT_URL`, then `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`. The pg runtime explicitly upgrades Neon's `sslmode=require` to `verify-full` in memory to preserve certificate verification across pg versions. Original pulled files are unchanged by that normalization.

`node scripts/check-neon.mjs` verified:

```json
{
  "pooledRuntime": true,
  "directMigration": true,
  "transportTls": true,
  "certificateVerified": true,
  "postgresBackendTls": false
}
```

Neon's proxy terminates the external TLS connection. `postgresBackendTls` describes the internal proxy-to-Postgres connection from `pg_stat_ssl`; it is not the browser/API client's transport status. The client TLSSocket independently confirmed encrypted transport and a verified certificate.

## Schema and administrator

The branch had no public application tables before setup. Both committed Prisma migrations were applied successfully through the direct connection with `npm run db:migrate`:

```text
Applying migration `20261027000000_initial`
Applying migration `20261027000001_constraints`
All migrations have been successfully applied.
```

The first administrator was created with the deliberate bootstrap command and a cryptographically random strong password supplied only in the child-process environment. Username: `store-admin`. The initial password-change workflow was completed in Chromium, producing a new random strong password. The current credentials exist only in the ignored local `.local/production-admin.json` file. They were never printed or put in a shell command. Use your password manager and remove the local copy after taking ownership. The default manager/shopkeeper permission grants were initialized while this database contained only the newly created administrator and no existing role grants; subsequent changes remain admin-controlled.

The development seed now requires a loopback database as well as a non-production environment and explicit opt-in. An attempted seed against this Neon branch correctly exited 1 **before creating demo accounts**, even with `ENABLE_DEMO_SEED=true`. Production does not use `admin/admin`.

## Build and end-to-end proof

`npm run build`, both workspace type checks and ESLint passed. All **21 automated tests across 3 files** passed, including explicit Neon TLS handling, rejection of remote demo seeding and isolation of caller-provided local database URLs from the production migration URL. The regression suite runs against a separate local disposable database, not the production branch. Dependency audit reported zero known vulnerabilities. The Vite build emits two non-fatal annotation warnings from Zod.

```text
> build
> npm run build --workspaces
> tsc -p tsconfig.json
> tsc --noEmit && vite build
✓ 1829 modules transformed.
✓ built in 2.75s

Test Files  3 passed (3)
     Tests  21 passed (21)
```

After building, `npm run preview` starts `node dist/server.js` plus Vite's built frontend preview. A real Chromium smoke test used the application API through the same-origin frontend proxy and the production Neon database. It verified:

- Secure administrator login; initial password change and re-login were verified on the first run.
- Missing-CSRF and wrong-Origin mutations return 403.
- A Bangla-named labeled QA product and Cloudinary image persist in Neon and display in the browser.
- Dashboard responses omit buying prices.
- A stock adjustment is recorded and calculations leave stock unchanged.
- Quantity 2 at buying price 200.10 yields purchase cost 400.20; expenses 10.05 yield minimum net estimate 90.35 and custom net estimate 129.75.
- Saved snapshot values survive a later price edit.
- The browser downloads an actual PDF, validated by its PDF signature.
- Logout revokes the session; current-user then returns 401.

Final smoke output against the compiled API and built frontend:

```json
{"status":"PASS","login":true,"csrfAndOrigin":true,"productAndImagePersisted":true,"dashboardDisplay":true,"costSafeDashboard":true,"stockAdjustment":true,"decimalCalculationAndSnapshot":true,"pdfDownload":true,"inventoryAndSnapshotUnchanged":true,"logoutRevocation":true}
```

QA products are archived, their Cloudinary assets were removed, and their labeled saved calculations/audit history remain as verification evidence. Browser screenshots, the downloaded report, and the sanitized smoke result are in ignored `.local/qa/`.

One first smoke attempt timed out because its API setup created a category after the UI had cached the empty category list. Reloading that test's page before opening the product form fixed the harness; the subsequent full runs passed. An initial inline database diagnostic also hit PowerShell quoting; the committed `scripts/check-neon.mjs` replaced it and passed. Neither failure affected stored application data.

## Remaining web deployment

This step provisions/connects PostgreSQL on Neon; it does not host this React frontend or Express backend. Local built preview: `http://localhost:5173`. Render and Vercel deployment, actual public `APP_ORIGIN`, Vercel's Render proxy destination, production Secure-cookie forwarding, hosted CORS/CSRF smoke tests and backup/restore rehearsal are still required. No live Render/Vercel URLs are claimed. Continue with `docs/DEPLOYMENT.md`; the private production env file has the Neon/Cloudinary values but intentionally leaves `APP_ORIGIN` unset until the real frontend URL is known.

Official references: [connection methods](https://neon.com/docs/connect/choose-connection), [pooling](https://neon.com/docs/connect/connection-pooling).
