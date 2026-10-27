# Deployment and operations

For the requested $0 live trial, use [the single-service Render guide](FREE_RENDER.md): the Docker image can now serve both React and the API with `SERVE_WEB=true`, and `render.yaml` selects Free without the paid-only pre-deploy step. Vercel Hobby is restricted to non-commercial personal use, so the split Vercel instructions below require an eligible paid plan for this business app. Render Free is a trial/testing option, not an always-on production guarantee.

Neon PostgreSQL is now linked and verified for project `cold-mud-71951638`, branch `production`; see [Neon setup record](NEON_SETUP.md). Cloudinary live upload/replacement was verified. Render/Vercel hosting is not yet provisioned. Those accounts and optional custom domains must be supplied by the operator. Do not enable demo seeds in production.

## PostgreSQL

Provision supported managed PostgreSQL (17+ recommended), UTF-8 encoding. Use a restricted application user. Set `DATABASE_URL` to the runtime connection string and `DIRECT_URL` to a direct connection for migration operations if the provider uses a pooler. Provider-managed TLS verification should remain enabled; use the provider CA and do not disable certificate validation. For external hosts use the provider's documented SSL options (typically `sslmode=require` plus their CA where necessary). Render-internal connections follow Render's network guidance.

The pg adapter pool has a maximum of 10 connections per API instance. Include deployment overlap, migration connections and admin tools when calculating the database connection limit. Scale the pool/instance count deliberately. Backups must include both business records and authentication data; use provider automatic backups plus encrypted offsite `pg_dump --format=custom` exports. Test restores into a separate database using `pg_restore --clean --if-exists --no-owner --dbname=RESTORE_URL backup.dump`. Never validate a restore by overwriting the live database.

## Render API

Use the repository root as Docker build context and `apps/api/Dockerfile` as Dockerfile. The included `render.yaml` is a configuration template, not proof of deployment or a paid-service authorization. Choose the service plan in Render yourself.

- Build: Dockerfile runs `npm ci`, Prisma generation, API TypeScript build, and Chromium/dependency installation.
- Start: `node dist/server.js`, working directory `/app/apps/api`.
- Health check: `/api/health/ready`. Liveness: `/api/health/live`.
- Bind: `0.0.0.0`, uses Render's supplied `PORT`.
- Trust exactly one edge proxy. HTTPS is required in production via forwarded protocol.
- Pre-deploy: `npm run db:migrate` from API workspace (paid Render services support pre-deploy commands). This applies committed migrations only, with direct connection URL. It must succeed before rollout.
- On a plan without pre-deploy support, run `npm run db:migrate` manually from a trusted release runner with production `DIRECT_URL` and `DATABASE_URL`, before deploying. Do not silently run migrations on every API startup.

Environment reference:

- `NODE_ENV=production`: secure cookies, HTTPS check; never use development mode on a public deployment.
- `PORT`: supplied by Render; defaults to 4000 locally.
- `DATABASE_URL`: required PostgreSQL runtime URL, secret.
- `DIRECT_URL`: direct migration URL; defaults to runtime URL when absent.
- `APP_ORIGIN`: exactly one frontend origin, e.g. `https://app.example.com`. No wildcard, paths or trailing slash.
- `SESSION_HOURS`: 12 by default, maximum 168; absolute expiry, no sliding refresh.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: server-side image-storage configuration. Use a dedicated Cloudinary environment. Secrets never belong in Vite variables.
- `LOG_LEVEL`: optional Pino log level.
- `BOOTSTRAP_USERNAME`, `BOOTSTRAP_PASSWORD`: only for deliberate bootstrap command; remove afterward.
- `ENABLE_DEMO_SEED`: leave unset/false. Production demo seeding is explicitly forbidden.

Use an unprivileged container user. Chromium is installed at image build time; PDF bytes are generated in memory. Images persist in Cloudinary, reports in PostgreSQL; the API filesystem has no persistent business data. Shutdown stops accepting connections, disconnects Prisma and has a 10-second deadline.

## Vercel frontend

Import the monorepo with **root directory `apps/web`**, and enable access to files outside the root. Framework: Vite. Install from repository root with `npm ci` (Vercel workspace detection usually does this). Build command in `vercel.json`: `cd ../.. && npm run build -w apps/web`. Output directory: `dist`. Use Node 24.x in project settings.

Set browser-safe `VITE_API_BASE=/api`. Replace `REPLACE-WITH-YOUR-SERVICE.onrender.com` in `apps/web/vercel.json` with the exact Render host before deploying. The first rewrite proxies `/api/*` to Render; the second serves SPA routes. Keep API rewrite ahead of the fallback. Do not expose any Cloudinary API secret, database URL or bootstrap password through `VITE_` variables.

Recommended domains: `app.example.com` on Vercel and `api.example.com` on Render. Verify domain ownership and TLS on both platforms. The supplied same-origin proxy is also recommended with custom domains, reducing CORS/cookie complexity. API CORS only permits the exact `APP_ORIGIN`, and mutation requests must present that Origin plus the session CSRF token.

Default `vercel.app` and `onrender.com` hosts are cross-site. Calling Render directly with a Lax session cookie will fail across sites and can encounter third-party-cookie restrictions. **Keep `/api` behind the Vercel rewrite** when using default hosts. The browser sends requests and host-only `__Host-cj_session` cookies to its own frontend origin; Vercel forwards request cookies and backend Set-Cookie responses. The API does not set a cookie Domain. Keep Secure, HttpOnly, Lax and Path=/; do not switch to browser token storage. The local Vite proxy exercises this same-origin cookie workflow in the browser test. Actual Vercel forwarding, Secure cookies and CDN behavior must pass the deployment smoke test below; hosting was not available here.

Preview deployments must use a separate preview backend/database with its **specific** preview origin. Never accept arbitrary Vercel origins by suffix matching. Disable preview authentication/backend access if an exact preview environment cannot be provisioned. CSP defaults to same-origin API connections; only Cloudinary is permitted for product images.

## Initial administrator

In a trusted Render shell or release runner, with production DB environment loaded:

```sh
# Supply both through the platform's secret environment, never commit them:
npm run bootstrap
```

The bootstrap validates the strong password and requires that no administrator already exists. It uses an advisory transaction lock and never prints credentials. Sign in once, replace the temporary password, then create other users through Menu Control → Users. Bootstrap does not create demo roles/accounts or seed business data; an admin can grant menus and add categories through the UI. Remove bootstrap secrets from the service afterward.

## Smoke test after deployment

1. Confirm both health endpoints return healthy (readiness tests PostgreSQL). Review Render logs for startup errors.
2. Open Vercel, bootstrap/login/change password. Verify cookie is `__Host-cj_session`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain; no token exists in localStorage.
3. Refresh a deep route. Confirm `/api/auth/me` works through the frontend host and an invalid Origin mutation fails with 403. Ensure API errors do not become SPA HTML.
4. Add a category and Bangla-named product, upload a JPEG, adjust stock, search Dashboard. Confirm thumbnails load and Cloudinary uses `chotto-jadughor/` assets.
5. Create a multi-product estimate, save and download a multi-page PDF. Verify Bengali shaping, table headers, page numbers, BDT totals and immutable snapshots after a price edit.
6. Create shopkeeper/manager accounts, require their password changes, test direct unauthorized API URLs. Change a grant and confirm immediate access changes. Disable a user and confirm their session is invalid.
7. Restart/redeploy API and verify data/images/reports survive. Test database backup restore separately.

## Rollback and failed migrations

Back up before migrations. Prefer additive/backward-compatible migrations and a separate later cleanup release. If the pre-deploy fails, retain the previous service, inspect migration logs and database state, and correct the underlying problem before retrying. Never run `prisma migrate reset` on production. Use `prisma migrate status`; only mark a failed migration rolled back with `prisma migrate resolve --rolled-back NAME` after its partial changes have been safely undone, or `--applied NAME` after an operator has verified the migration was completed manually. Document that decision. Roll back application code to the prior image only if compatible with the current schema. Destructive schema reversal requires a reviewed corrective migration or a tested backup restoration and a maintenance window; Prisma does not generate safe automatic down migrations.

Official references checked during implementation: [Prisma 7](https://www.prisma.io/docs/orm/v7), [Vite requirements](https://vite.dev/guide/), [Node LTS](https://nodejs.org/en/about/previous-releases), [Render deploy/pre-deploy behavior](https://render.com/docs/deploys), [Cloudinary Node uploads](https://cloudinary.com/documentation/node_image_and_video_upload), and [Playwright PDF](https://playwright.dev/docs/api/class-page#page-pdf).
