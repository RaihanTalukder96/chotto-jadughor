# Verification record

Update after Neon integration: project `cold-mud-71951638`, branch `production`, is deployed and wired using CLI-pulled env variables. Both migrations, verified client TLS, secure admin bootstrap, the compiled application browser workflow through PDF download, all 21 regression tests, type checks, lint and production builds passed. See [the complete Neon setup record](NEON_SETUP.md) for commands, sanitized output, recovered CLI/test-harness failures, and the precise boundary between completed database setup and pending Render/Vercel hosting.

Verified locally on 27 October 2026 (Asia/Dhaka) using bundled Node 24.22.1 and project-local npm 11.6.2. The machine's default Node 12/npm 6 were not suitable; no global runtime was changed. Docker was unavailable, so PostgreSQL 18.4 was run temporarily from an isolated, ignored project-local installation, initialized as UTF-8 and bound to loopback. The deployable Compose/CI configuration uses PostgreSQL 17. The Docker image and hosted CI workflow are supplied but were not run on this Windows host.

Passed:

- Prisma client generation and both committed migrations on fresh PostgreSQL databases.
- Both workspace TypeScript checks and ESLint.
- API and Vite production builds. Rollup emits two non-fatal Zod dependency annotation warnings; bundles build successfully.
- **18 automated domain/API tests**, including decimal scenarios, zero denominators, losses/expenses, tampered fields, login matching and failure messages, hashed sessions, initial password restrictions, revocation/expiration, cost-safe dashboard responses, direct permission checks, immediate permission changes, last-active-admin protection, duplicate IDs/SKUs, optimistic edit conflicts, ownership, immutable snapshots, protected PDF endpoints, supported-image re-encoding, SVG/disguised uploads, oversized multipart uploads, login throttling and stale-password session issuance prevention. The last-admin test ran against a dedicated database with exactly one active administrator.
- **One real Chromium end-to-end workflow**: sign in, replace the initial password, sign in again, create a Bangla-named product, find it on Dashboard, create/save an estimate and download its backend PDF. It also verifies a 390px layout has no horizontal page overflow. The initial-password regression and a final run both passed.
- Desktop catalog/calculation and mobile catalog screenshots inspected. Mobile navigation is hidden from focus when closed; the native dialog supplies modal focus handling.
- An **80-line, 13-page** server-generated PDF was rasterized with Poppler. First, repeated-header and final-summary pages were inspected for Bengali conjunct shaping, amounts, notes, headers and page numbering. Noto Sans Bengali fonts are embedded; no font network request is needed.
- `npm audit --audit-level=low`: **zero known vulnerabilities** in the final lockfile at verification time.

Reproduction commands are in the root README. `scripts/verify-report.ts` generates the synthetic Bangla PDF fixture under ignored `.local/qa/`; it does not seed or affect application business data. Browser artifacts and QA screenshots/PDFs also reside there. `tests/browser/workflow.spec.ts` contains the full browser procedure. `.github/workflows/ci.yml` provides a reproducible Linux/PostgreSQL workflow for future repository CI; it has not yet run on GitHub.

External verification still required:

- Cloudinary provider-failure retry scenarios still need controlled failure testing. Update, 27 October 2026: real authenticated application uploads, browser thumbnail display after reload, replacement, old-asset queueing/deletion, preservation of the referenced replacement, and final test-asset removal all passed with the user's configured credentials. Only generated QA assets and a separate local test database were used. For cleanup, only the test queue timestamps were aged beyond the 10-minute grace period, then the actual cleanup function ran; natural scheduler timing was not tested. Secrets were never printed.
- Vercel and Render builds/deployments, managed PostgreSQL TLS/network setup, DNS, paid-plan pre-deploy availability, production cookie forwarding through Vercel and platform health checks. Local same-origin Vite cookie proxy was exercised, but this is not a claim of successful hosted deployment.
- Production backup/restore rehearsal and capacity testing at your actual usage volume.

Deployment instructions include the exact remaining configuration and smoke-test steps. No paid resources were purchased or provisioned. Login throttles are process-local: use one API instance or install a shared limiter before scaling horizontally. PDF generation starts one Chromium instance per request; set edge rate limits and capacity appropriate to the service plan. Optional multiple product images are intentionally omitted; one main image is fully supported. User and audit lists are capped for the small-store scope (200 and 100 entries respectively).
