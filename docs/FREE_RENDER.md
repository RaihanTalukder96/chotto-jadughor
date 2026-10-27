# Free live trial: frontend and API in one Render service

The business app cannot use Vercel's Hobby plan, which is restricted to non-commercial personal use. For a $0 live trial, the prepared Docker image now builds both workspaces and Express serves the React bundle when `SERVE_WEB=true`.

This deployment has one origin:

```text
https://YOUR-SERVICE.onrender.com/       React frontend
https://YOUR-SERVICE.onrender.com/api/   Express API
```

Neon PostgreSQL and Cloudinary remain external durable storage. A separate frontend proxy is unnecessary because UI and API share the same origin. Production cookies stay Secure, HttpOnly, SameSite=Lax and host-only; CORS and mutation Origin checks allow only the exact `APP_ORIGIN`. CSRF tokens remain required for protected mutations. No credentials go in `VITE_` variables.

## Dashboard steps

1. Push the reviewed latest code and lockfile to the existing GitHub repository `RaihanTalukder96/chotto-jadughor`. Never include `.env*`, `.neon` or `.local/production-admin.json`. Local uncommitted changes do not reach Render.
2. Open https://dashboard.render.com/ and sign in/connect GitHub. Choose **New → Web Service**, then that repository.
3. Choose a service name such as `chotto-jadughor`; Render may add a suffix if the hostname is taken. Choose **Singapore**, matching Neon.
4. Runtime/language: **Docker**. Root Directory: leave blank. Dockerfile Path: `apps/api/Dockerfile`. Docker Build Context: repository root (`.`). Do not enter Vite commands into the Docker Start Command; leave that override blank so the Dockerfile CMD starts Express.
5. Instance Type: **Free ($0)**. Do not select Starter or another paid tier. If Render requires a payment method or paid selection, stop and review the screen before proceeding.
6. In **Environment**, enter these values privately from `apps/api/.env.production.local`:
   - `NODE_ENV=production`
   - `SERVE_WEB=true`
   - `APP_ORIGIN=https://YOUR-EXACT-SERVICE.onrender.com` (no trailing slash; match the actual assigned Render URL)
   - `DATABASE_URL`: pooled Neon URL
   - `DIRECT_URL`: direct Neon URL
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `ENABLE_DEMO_SEED=false`
   - `SESSION_HOURS=12` (optional)
   Render provides `PORT`; do not replace it with a localhost URL. Do not paste the entire private env file blindly because its APP_ORIGIN is not yet set. Do not add BOOTSTRAP_PASSWORD to the running service: the administrator already exists.
7. Health Check Path: `/api/health/ready`. Create/deploy the **Free** service. The Dockerfile installs Chromium for server PDF rendering and builds both apps. No separate frontend deployment is needed.
8. When deploy completes, open the assigned HTTPS URL and sign in with the existing `store-admin` credentials from your ignored local credentials file. Share only the public service URL with the assistant for smoke testing, never secrets.

## Migrations

Both initial migrations have already been applied to Neon. Free Render does not offer paid-service pre-deploy commands. The updated `render.yaml` deliberately omits `preDeployCommand` and selects `plan: free`. For future schema releases, back up/check compatibility, apply committed migrations deliberately from a trusted local/release environment with the direct URL, then deploy. Never run demo seeds against Neon; the application now rejects that.

## Free limits and verification boundary

Local verification passed after preparing this option: frontend/API builds, ESLint, all 22 automated tests, plus a real Chromium check against the compiled single-origin server covering login, `/products` deep-route refresh, Neon readiness, JSON API errors and logout. A hidden-directory test fixture initially exposed sendFile path handling; serving the index relative to its explicit build root corrected it and the regression passed. These checks do not establish a successful Render deployment.

Render Free sleeps after 15 minutes without traffic. A later visit can take about a minute to wake it. Included usage limits apply; this is not guaranteed always-on hosting. Render explicitly advises against Free instances for production applications. Free compute has 512 MB RAM; server-generated Chromium PDFs must be tested on the actual instance before relying on it for store operations. The local Docker image cannot be built here because Docker is unavailable; local Node build, route behavior and application workflow can be tested, but the Render image build, startup and hosted PDF memory behavior remain to be verified after deployment.

Smoke-test the assigned public HTTPS URL: login, deep-route refresh, cookie flags, valid/invalid CSRF and Origin, real image display/replacement, saved estimate and PDF download. Database and image data persist in Neon/Cloudinary across sleeping/restarts. Do not treat local preview or prepared config as a completed public deployment.

Official references: https://render.com/docs/free, https://render.com/docs/compute-plans, https://vercel.com/docs/plans/hobby.
