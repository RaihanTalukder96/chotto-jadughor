# Chotto Jadughor branding

The supplied `logo-chotto.jpeg` is preserved byte-for-byte at `apps/web/public/brand/logo-chotto.jpeg`. It is a user-provided brand asset, not a generated replacement. Vite copies the public asset into the web build and the Express single-origin deployment serves it without authentication. The PDF generator reads this same source asset relative to its module and embeds it as a data URL; no remote request or Cloudinary credential is needed for the logo.

The theme follows the logo:

- Navy `#082f5b`: text, headings, main buttons and report rules.
- Blue `#049ee2`: decorative accents; darker `#0675af` is used for readable blue text and focus outlines.
- Pink `#d62560`: active navigation accents, hearts and custom-scenario accents.
- Green `#087b3d`: positive stock, selling prices and success accents.
- Pale blue, pink and green surfaces retain white cards and clear form borders.

The original logo appears on the sidebar, login and initial-password screen, header, footer, catalog banner, loading state, product-image fallback, favicon/touch icon and server-generated PDF reports. House and heart decorations echo the logo rather than the previous floral identity. Product photos remain unmodified.

Verification: frontend/API builds and lint passed; original-logo loading, four authenticated desktop pages, 390px mobile login/dashboard and navigation were checked in Chromium. A mobile login intrinsic-width issue was corrected and the overflow check passed. Logo-bearing Bangla report pages were generated and inspected with Poppler. Existing business logic and access controls are unchanged by this branding update. QA captures remain under ignored `.local/qa/brand/`.
