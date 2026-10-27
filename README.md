# Chotto Jadughor · ছোট্ট জাদুঘর

Internal baby-products store workspace. React/Vite frontend, Express API, PostgreSQL/Prisma, server-managed sessions, Cloudinary images and Chromium PDF reports. No checkout, sales recording or payment features. Estimates never change inventory.

The existing workspace is now linked to Neon project `cold-mud-71951638`, branch `production`. See [Neon setup and verification](docs/NEON_SETUP.md). Root `.env.local` contains private CLI-pulled database variables and takes precedence over backend development defaults. To use a separate local database, explicitly supply both `DATABASE_URL` and `DIRECT_URL`, or set `DOTENV_CONFIG_PATH` to a local-only env file. Demo seeding refuses all remote databases.

## Start locally

Install Node **24.22.1** (see `.nvmrc`) with npm 11 or newer. Older system Node/npm installations do not support this monorepo.

```sh
npm ci
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run db:generate
npm run db:migrate
npx playwright install chromium
```

For explicitly enabled **local development only**, set `ENABLE_DEMO_SEED=true` in `apps/api/.env`, then run:

```sh
npm run db:seed
npm run dev
```

Open `http://localhost:5173`. Demo usernames/passwords are `admin`/`admin`, `store manager`/`store manager`, and `shopkeeper`/`shopkeeper`. All require a new strong password at first sign-in. Seed reruns preserve passwords. Demo seeding refuses production. No demo products are inserted; add real products in Manage Product. Categories are seeded for convenience. The seed grants default role permissions only if that role currently has no grants; do not rerun it to preserve an intentionally fully revoked development role.

Configure Cloudinary to upload images; catalog and estimates work without it locally. Missing credentials return a clear upload error. Docker is optional if an existing PostgreSQL instance is available: set `DATABASE_URL` and `DIRECT_URL` appropriately.

## Commands

- `npm run dev`: API on 4000 and Vite on 5173, with same-origin `/api` proxy.
- `npm run build`: TypeScript API output and optimized web bundle.
- `npm run preview`: run the compiled API and built frontend at `http://localhost:5173` after building. This is local verification, not hosted deployment.
- `npm run typecheck`, `npm run lint`, `npm test`: checks and domain tests.
- `npm run db:generate`: regenerate Prisma Client after schema changes.
- `npm run db:migrate`: apply committed migrations, without generating new ones.
- `npm run bootstrap`: deliberately create the first production administrator using `BOOTSTRAP_USERNAME` and `BOOTSTRAP_PASSWORD` in the command environment. Refuses to overwrite or create another administrator.
- `TEST_DATABASE_URL=postgresql://... npm test`: API integration suite. **Use a dedicated disposable database, already migrated**. Tests temporarily change role grants and create/delete test records. Never point at production.
- `npm run test:e2e`: real Chromium workflow, against a migrated, locally seeded database. `E2E_USERNAME` / `E2E_PASSWORD` override demo defaults. The first run changes the admin password to the test password defined in the spec; use a disposable database.

For Windows PowerShell, set variables with `$env:NAME='value'` before running commands. Run migration/generation commands from the monorepo root so npm changes to the API workspace and loads `apps/api/.env`.

## Workflows and assumptions

Dashboard cards expose names, descriptions, identifiers, category, stock and selling prices; buying prices are selected only by privileged endpoints. Product names can contain Bangla. Currency is BDT; server timestamps use UTC `timestamptz`, while the UI/PDF display Asia/Dhaka.

Product IDs and SKUs are user-assigned, case-sensitive unique codes. Usernames are trimmed, Unicode NFKC normalized and lowercased for matching; internal spaces are preserved. Usernames with spaces work. Passwords require 12–128 characters, uppercase, lowercase, number and symbol. Resets, password changes, role changes and account disabling revoke all existing sessions. Users must sign in again after a password change.

Stock is changed through explicit adjustments with a reason, actor and timestamp. Initial creation records opening stock. All product writes use a version check; conflicts require reloading. Archiving preserves history. The main image is limited to one per product, an intentionally simple supported option. Categories can be renamed/deleted; referenced categories cannot be deleted.

Manage Product grants `products.read` and `products.manage`. Profit Calculation grants `calculations.use` and `reports.export`, including the cost information needed for estimates. Menu Control and Users remain admin-only. Changes are read from PostgreSQL on every request. Admin edits serialize on a PostgreSQL advisory lock to protect the last active administrator.

Calculation requests contain only product UUIDs, quantities, optional custom prices, expenses, title and notes. Unknown fields (including submitted totals and buying prices) are rejected. The server reads current prices and computes with Decimal.js; API monetary values are decimal strings. Custom scenarios fall back to minimum prices. Additional expenses affect scenario net estimates once, at calculation level. Zero-denominator margin/markup is N/A. Stock/range/loss warnings do not block hypothetical estimates; the UI requires acknowledgment before saving warned results.

Saved calculations contain immutable product snapshots plus totals and a prepared-by name snapshot. Only their owner and administrators can read/export them. There is no update endpoint. “Create copy & refresh current prices” explicitly loads current prices and saves a new report linked to the source. Archived/unavailable source products must be replaced in a new calculation. Historical PDFs always use saved snapshots.

See [deployment](docs/DEPLOYMENT.md), [security and API](docs/SECURITY.md), and [verification](docs/VERIFICATION.md) for operational details and limitations.
