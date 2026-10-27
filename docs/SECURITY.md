# Architecture, security and API

The frontend stores only in-memory current-user/CSRF state. TanStack Query fetches server state; React Hook Form/Zod handle product/login forms. Backend Zod schemas validate all mutations, including unknown-key rejection. PostgreSQL constraints and transactions provide the final integrity boundary. Prisma's pg adapter uses parameterized queries; raw SQL is restricted to fixed advisory locks/health queries.

Opaque 256-bit session tokens travel only in HttpOnly cookies. SHA-256 hashes are stored in Session; a separate random synchronizer CSRF token is exposed by authenticated `/auth/me` and submitted in `X-CSRF-Token`. Every mutation requires exact `Origin`, including login. Protected mutations additionally require session-bound CSRF. Login is protected against CSRF by exact Origin and JSON requirements. Production cookies use `__Host-`, Secure, Lax, Path=/ and no Domain. Passwords use Argon2id (64 MiB, three iterations, parallelism one). Failed logins are generic and verify a dummy hash for nonexistent users. Login IP rate limiting is process-local (15 attempts/15 minutes), with a second normalized-account limit (10 failed attempts/15 minutes). Use one API instance or add a shared PostgreSQL/Redis limiter before horizontal scaling; edge throttling should complement it.

Session expiry is absolute. Auth checks account activation/expiry on each request, and loads current role grants. Initial/reset credentials can reach only current-user, logout and password-change endpoints until changed. User disabling, role changes, access resets and password changes delete sessions transactionally. Last-active-admin removal serializes with bootstrap/admin changes. Bootstrap does not modify existing passwords.

Admin/user/product/category/stock/image/permission/calculation mutations are audited with actor, action, entity ID and UTC timestamp. Audit data contains no passwords, session tokens, report notes or uploaded bytes. Logs use request IDs, status and URL paths without query strings; request/response cookies are redacted, bodies are not logged. Error messages expose validation/expected conflicts but no stack, server path or database internals. Helmet handles API headers. Body limit: 128 KiB. Page size: ≤50. Calculation: ≤100 unique products, integer quantities ≤1,000,000. Upload: one file ≤5 MiB, decoded pixel limit 25 million, supported JPEG/PNG/WebP only. Sharp strips metadata and re-encodes to WebP; SVG and disguised content are rejected. Corrupt supported-format files fail processing rather than being stored.

Images upload through the authenticated API with product-management permission. Clients supply a product UUID, never a public ID to delete. Cloudinary assets use random application-scoped public IDs. A durable cleanup row is created **before** upload; failed/abandoned uploads remain queued. Attaching the image, incrementing product version, removing the new cleanup row and queueing the previous asset are transactional. Cleanup runs every 15 minutes with a 10-minute grace period and checks product references before deletion; provider failures retain the queue for retry. Product uploads/replacement with stale versions fail safely. Store Cloudinary credentials exclusively on the backend. Periodically review Cloudinary/cleanup failures and upload quotas.

PDFs require session, export permission and calculation ownership (admins may access all). Server-rendered HTML escapes all user-controlled text, embeds bundled Noto Sans Bengali font assets under SIL OFL, blocks network requests and prints with Chromium shaping. The font package includes its license in the installed dependency. API container must ship Chromium and OS dependencies. Reports are generated in memory and downloaded with UUID-based safe filenames; no user path/name is used as a filesystem path. Add edge request throttling and tune PDF concurrency for high-volume use; this small-store implementation starts an isolated browser per report.

## REST routes

All routes begin `/api`. Errors: `{ "error": { "message": "...", "requestId": "..." } }`; expected statuses include 400 validation, 401 session, 403 permission/CSRF, 404 unavailable/foreign-owned object, 409 duplicate/conflict/in-use, 413 too large, 429 throttled and 503 unconfigured image service.

- `GET /health/live`, `/health/ready`: public operational status; ready checks PostgreSQL without secrets.
- `POST /auth/login`: username/password; no public registration.
- `GET /auth/me`: user, role, current permissions and CSRF token.
- `POST /auth/logout`, `/auth/password`: password change requires current password and strong new `password`.
- `GET /dashboard`: safe catalog; `dashboard.read`.
- `GET /categories`: available to dashboard/product/calculation users after password change.
- `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`: `products.manage`.
- `GET /products`: privileged cost catalog; `products.read`.
- `GET /calculation-products`: current cost catalog; `calculations.use`.
- `POST /products`, `PUT /products/:id`: strict product fields, including version for edits. Stock may not change in an edit.
- `PATCH /products/:id/archive`: `{version, archived}`.
- `GET /products/:id/stock`, `POST /products/:id/stock`: history; adjustment `{version, change, reason}`.
- `POST /products/:id/image`: multipart `image`, `version`; `DELETE /products/:id/image`: JSON `{version}`.
- `POST /calculations/preview`, `POST /calculations`: `{title, notes, expenses, sourceId?, items:[{productId, quantity, customPrice?}]}`. No submitted costs/totals accepted.
- `GET /calculations?page=1`: 20 reports per page, owner scoped; admins see all.
- `GET /calculations/:id`, `/calculations/:id/pdf`: snapshot and PDF, always owner scoped.
- `GET /admin/permissions`, `PUT /admin/permissions`: toggle `{role:MANAGER|SHOPKEEPER, menu, enabled}`.
- `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id`: create `{username,password,role}`, edit `{role?,active?,password?}`. Lists capped at 200 for this small-store scope.
- `GET /admin/audit`: latest 100 entries.

Catalog query: `page`, `limit`, `search`, optional `categoryId`, `sort=name|newest|price`, and privileged `archived=true|false`. Archived catalog queries explicitly select archived-only products. Search is case-insensitive across name/product ID/SKU. Catalog uses indexed archived/category/name predicates, capped pagination and Cloudinary thumbnails; large substring-search catalogs may need a trigram index after measuring real data.

