# Chotto Jadughor branding

The supplied high-resolution PNG is preserved byte-for-byte at `apps/web/public/brand/chotto-jadughor-logo.png`. The original artwork is used without cropping or recoloring. Vite serves this asset locally and includes it in deployment builds. The PDF generator embeds the same PNG directly; it needs no remote image request.

The theme uses forest green `#1e4818` for headings and primary actions, warm cream `#fff8ee` for the canvas, burnt orange `#ad5000` for accents, and pale sage/cream surfaces. Error and warning colors retain their distinct meaning. Theme variables use semantic primary, accent and success names.

The new logo appears on the login and password screens, sidebar, header, footer, loading state, product-image fallback, favicon/touch icon and PDF reports. The removed catalog banner stays removed. Existing product photos and business workflows are preserved.

Verification: build and lint passed. Desktop and 390px mobile login were checked in Chromium: the 2000px logo loaded and mobile had no horizontal overflow. A sample Bangla PDF using the new PNG was generated and rendered for review. Private QA artifacts remain under ignored `.local/qa/brand/`.
