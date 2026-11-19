# Customer shop and administration

See [product galleries and options](PRODUCT_MEDIA_OPTIONS.md) for four-photo galleries, Size/Color/Type choices and the cart/order API additions.

Both portals use the existing project, API, database and domain. The customer shop lives at `/`; the staff workspace moved to `/admin`. On Render keep `SERVE_WEB=true`, and set `APP_ORIGIN` to the exact public origin, without a trailing slash. No separate Vercel project, domain, payment provider or paid service is required for this feature.

## Routes

- `/`: branded storefront, collections, latest/featured products and brand promise.
- `/shop`: search, category/subcategory/brand, price and sale filters, sorting and pagination.
- `/product/:id`: details, price/sale, stock, quantity, related products and optional WhatsApp contact.
- `/wishlist`, `/cart`, `/checkout`: browser-persisted favourites and shopping bag; guest or signed-in Cash on Delivery checkout.
- `/account`: customer registration/sign-in, private order history, password change and logout.
- `/track`: order number plus a private, random tracking key. Customer address/phone are not returned by public tracking.
- `/policies/delivery`, `/policies/returns`, `/policies/privacy`: operator-managed information.
- `/admin`: staff dashboard; `/admin/products`: catalog, images and inventory; `/admin/calculations`: existing estimates and PDFs; `/admin/control`: users and permissions.
- `/admin/shop`: shop settings; `/admin/orders`: customer order management.

## Prepare the catalog

Manage Product supports individual deletion from each card or product details, and bulk deletion using checkboxes. “Select all on this page” selects only the currently displayed page; changing filters or pages clears selection. Each action asks for confirmation and lists the products. Deleted products disappear from active and archived catalogs, customer browsing, and new calculations/orders. They cannot be restored through Archive. Product IDs/SKUs stay reserved; internal product/stock records and immutable saved order/report snapshots are retained for history and cancellation reconciliation. Product photos are detached and queued for the existing Cloudinary cleanup worker.

Staff API: `DELETE /api/products/:id` with `{ "version": 1 }`, or `POST /api/products/bulk-delete` with `{ "products": [{ "id": "PRODUCT_UUID", "version": 1 }] }`. Both require `products.manage`, staff session CSRF and the configured origin. Bulk requests accept 1–100 distinct products and are atomic: any missing, already deleted or stale-version product returns 409 and rolls back the whole batch. Deleted products cannot be edited, restored, uploaded to or have stock adjusted through product management. Existing order cancellation may still reconcile the retained stock record without making the product visible again. Deletion is application-level removal with a retained internal record, not physical erasure of business history.

Run `npm run build`, `npm run db:migrate`, then `npm run shop:prepare` using the intended database environment. The script creates eight categories, sixteen subcategories and thirty-two starter product drafts covering clothing, toys, skincare, bath/grooming, feeding, diapers/changing, travel/accessories and mom care. Existing names/SKUs are reused; reruns never overwrite operator edits. This script is deliberate, not an automatic startup seed.

Starter prices are provisional suggestions, buying prices are zero placeholders, and stock is zero. These products are unpublished. Verify actual supplier/brand, specifications, manufacturer age/usage guidance, relevant ingredients/batch/expiry information and prices. Replace draft copy and upload real photos. Add actual inventory using Adjust stock; set buying/internal estimate prices separately. Enable “Publish in customer shop” only after review. A positive customer price is required; a sale price must be positive and lower than it. Featured products appear on the homepage. Archived/unpublished products cannot be ordered.

## Enable ordering

In Online Shop, enter a real phone number, support/WhatsApp details as available, store/return address, inside/outside Dhaka delivery charges, delivery timing, return policy and privacy policy. Optional fields can remain empty. Orders remain paused until required contact/address, both charges and all policies are set and “Accept Cash on Delivery orders” is enabled. A zero delivery charge is supported if intentionally entered. No phone number, delivery promise or policy has been invented for the business.

All checkout amounts are calculated by the API from current database prices using decimal arithmetic. The shopper reviews delivery and the final total before submitting. Changed prices or insufficient stock reject checkout; refreshing the quote lets the shopper review again. The order contains immutable name/SKU/price snapshots. Payment is Cash on Delivery only: there is no payment collection, fake payment success screen or automatic paid status.

Orders reserve stock immediately. Transitions are PENDING → CONFIRMED → SHIPPED → DELIVERED; PENDING/CONFIRMED can instead become CANCELLED, restoring inventory exactly once. Shipped orders cannot be silently cancelled/restocked; returns after shipping need an operator's deliberate stock adjustment. Status updates require the current version. Concurrent checkouts cannot oversell the last unit. Repeated submissions with the same request key and tracking secret return the same order.

## Accounts and privacy

Staff and customer accounts, cookies and sessions are separate. A customer cannot access staff APIs or buying prices. Staff order access requires `orders.manage`; administrators have it, and other roles can be granted Customer Orders in Menu Control. Shop settings and publication require `products.manage`.

Customer sessions are opaque tokens stored as hashes in PostgreSQL, with HttpOnly/SameSite cookies and Secure cookies in production. Mutations require the exact deployment Origin and a same-origin CSRF token, including guest checkout. Rate limits cover sign-in, registration, order creation and tracking. Password changes revoke customer sessions. Expired sessions are periodically removed. No CORS wildcard or cookie security bypass is introduced.

Guest orders are not attached to an account just because its email matches. The checkout receipt shows a random 256-bit tracking key; only its hash is stored on the server. The current browser keeps recent tracking keys locally for convenience. Clearing browser storage removes them, so customers should save their receipt/key. Tracking links never put secrets in URLs. Do not share keys publicly. Account history shows the signed-in customer's orders, up to the latest 100. Email verification, password-reset emails, SMS notifications, courier integration and online payment are not configured; they require real service/provider setup. Customers can use guest checkout without an account.

## Deployment and checks

Commit and deploy the application changes together, applying the additive migration before the new API starts. The migration leaves existing products unpublished and keeps all existing data. The Render free service's existing cold-start/memory limitations remain. No automatic deploy or push is performed by this implementation.

Verification uses the isolated local PostgreSQL test database, never production customer data. Automated API tests cover data exposure, draft visibility, price filters, CSRF/origin rejection, server totals, tracking secrets, retry idempotency, stock contention, customer/staff isolation, password/session behavior, cancellation and paused checkout. Chromium smoke checks exercise customer shopping/checkout/tracking, admin order cancellation/settings/price publication and responsive pages. Private screenshots are stored under ignored `.local/qa/shop/`.

Verification on 2026-11-03: build and lint passed; all 31 tests in 5 files passed. Chromium verified home, catalog, details, wishlist, cart, COD placement, private tracking, admin login/routing, order cancellation, settings save, admin price changes appearing publicly and an existing calculation PDF download. Home was checked at 390, 768 and 1440px, with additional mobile catalog/account/wishlist/tracking checks and no browser errors. Staff code is loaded separately from the customer bundle. These are localhost/isolated-preview results; no live Render deployment or hosting smoke test is claimed.
