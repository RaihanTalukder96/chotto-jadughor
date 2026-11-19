# Product galleries and customer options

Manage Product → open a product → Edit product now supports up to four photos. Select several files under Add images and save the product. Existing photos can be replaced or removed individually, or made the cover; these three actions save immediately. The cover appears in lists. JPG, PNG and WebP are accepted, up to 5 MB each. All files are content-validated before upload. Files are normalized to WebP, limited to 25 million decoded pixels and resized to fit within 1800px. Cloudinary retains the files; PostgreSQL stores their order and references.

Customer product detail pages have thumbnails, previous/next navigation and an image counter. The gallery works on mobile. Existing single-image products keep their photo as the first cover image.

## Options

In the product editor, add up to three option groups such as Size, Color and Type. Enter choices separated by commas, e.g. `S, M, L, XL` or `Red, Blue`. Each group has 1–20 distinct choices. Group names must be unique (case-insensitive). Blank/duplicate choices are rejected. Products without groups continue to order normally.

Customers must choose a valid value from every group before adding the product. Product cards lead to Choose options when choices are required. Different selections of the same product form separate bag lines; quantity controls and removal affect only the chosen line. The checkout quote validates the choices again against the current catalog. Deleted/renamed options require the shopper to update the cart. The selected names and values are snapshotted in the order and appear in checkout, confirmation, history/tracking and admin Customer Orders. Later product edits do not rewrite old orders.

All choices share the product's current retail/sale price and overall stock. This is not a per-variant SKU/price/inventory matrix. Combined quantities across all option combinations are checked against the same stock pool, including concurrent checkout and cancellation. Configure separate products when different choices need separate stock/prices until variant inventory is added.

## API contract

Staff endpoints below inherit staff authentication, permission `products.manage`, exact-origin checks and session CSRF checks. Multipart requests carry a `version` field; JSON mutations carry a positive integer `version`. Stale changes return 409. Image records have `id`, `url`, `thumbnail`, `publicId`, `productId` and zero-based `position` for staff; public catalog responses expose ordered URL/thumbnail pairs only.

- `POST /api/products/:id/images`: multipart `images` files (1–4); appends within the four-photo cap. Response 201: `{ "ok": true, "version": 12, "images": [...] }`.
- `POST /api/products/:id/images/:imageId`: multipart single `image`; replaces this product's photo and preserves its position. Same response shape.
- `PATCH /api/products/:id/images/:imageId/cover`: JSON `{ "version": 11 }`; moves the chosen photo to first place. Response 200 with updated version/gallery.
- `DELETE /api/products/:id/images/:imageId`: JSON `{ "version": 11 }`; removes one photo and compacts ordering. Same response shape.
- Legacy `POST /api/products/:id/image` still replaces the first photo (or creates one if absent); legacy DELETE removes only that first photo.

Photo count/order changes and the product version update are atomic. Position uniqueness and a database check restrict galleries to four slots. Uploaded assets enter the existing cleanup queue before provider upload; a successful DB transaction removes the new assets from that queue and queues only replaced/deleted assets. Failed uploads or stale writes leave unattached assets queued for later cleanup. Referenced files are protected by the cleanup worker.

Product create/update accepts an optional `options` array:

```json
{
  "options": [
    { "name": "Size", "values": ["S", "M", "L"] },
    { "name": "Color", "values": ["Red", "Blue"] }
  ]
}
```

Use explicit `[]` to remove all groups. Omission preserves existing groups on update, supporting older clients. Group names are at most 30 characters and values at most 50.

Quote/checkout cart items now optionally include `selectedOptions`, defaulting to `{}` for simple products:

```json
{
  "zone": "DHAKA",
  "items": [
    { "productId": "PRODUCT_UUID", "quantity": 1, "selectedOptions": { "Size": "M", "Color": "Red" } },
    { "productId": "PRODUCT_UUID", "quantity": 1, "selectedOptions": { "Size": "L", "Color": "Blue" } }
  ]
}
```

The identical product/selection combination may appear only once, independent of JSON key order. Missing, unknown or extra selections return 400; combined insufficient stock returns 409. Receipt and staff order items include `selectedOptions`. Checkout retry identity includes the selections, so a different combination cannot silently reuse an earlier order request.

## Migration and verification

Deploy the gallery migration and updated API/frontend as one coordinated release: the old single-image uniqueness constraint is replaced with product/position uniqueness, so old upload code must be replaced at rollout. Existing images and orders are preserved; old orders gain empty selection objects. No new environment variables are needed.

Verification on 2026-11-19: typecheck/build/lint passed; the 33-test suite covered valid/invalid options, different combinations in one order, stock aggregation, snapshot preservation, gallery ordering, cover changes, stale writes and cleanup queue behavior. A browser smoke test used isolated local PostgreSQL records and real Cloudinary uploads to verify four photos, thumbnail/carousel navigation, required size/color selection, separate cart quantities, COD order options, cover/replacement/removal/append, rejection of a fifth photo, reload display and mobile overflow. Six generated Cloudinary assets were removed after testing. Real business products and orders were not used for those tests.
