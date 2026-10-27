import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function reportPdf(c: any) {
  const font = await readFile(
    require.resolve(
      "@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff2",
    ),
  );
  const latin = await readFile(
    require.resolve(
      "@fontsource/noto-sans-bengali/files/noto-sans-bengali-latin-400-normal.woff2",
    ),
  );
  const r = c.results;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(
      `<html><head><meta charset="utf-8"><style>@font-face{font-family:Report;src:url(data:font/woff2;base64,${font.toString("base64")})} @font-face{font-family:Latin;src:url(data:font/woff2;base64,${latin.toString("base64")})}body{font:10px Report,Latin,sans-serif;color:#283b35}h1{font-size:24px}h2{font-size:17px}table{width:100%;table-layout:fixed;border-collapse:collapse;margin:18px 0}th,td{text-align:left;padding:9px 5px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}.badge{padding:12px;background:#edf4ed}th{background:#edf4ed}th:first-child{width:23%}th:nth-child(2){width:4%;white-space:nowrap}th:nth-child(3),th:nth-child(4),th:nth-child(5){width:7%}th:nth-child(6){width:11%}th:nth-child(7){width:7%}th:nth-child(8),th:nth-child(9){width:17%}td:nth-child(2),td:nth-child(3),td:nth-child(4),td:nth-child(5),td:nth-child(7){white-space:nowrap}</style></head><body><h1>Chotto Jadughor · ছোট্ট জাদুঘর</h1><h2>${escape(c.title)}</h2><p>${escape(c.reportNumber)} · ${escape(new Date(c.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }))} (Asia/Dhaka)<br>Prepared by ${escape(c.preparedBy)}</p><p class="badge">Hypothetical estimate — not a sales invoice. No stock has been changed.</p><table><thead><tr>${["Product / SKU", "Qty", "Buy", "Min", "Max", "Custom", "Cost", "Revenue min / max / custom", "Profit min / max / custom"].map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>${c.items
        .map((i: any) => {
          const s = i.snapshot;
          return `<tr><td>${escape(s.name)}<br>${escape(s.productId)} / ${escape(s.sku)}</td><td>${s.quantity}</td><td>${s.buyingPrice}</td><td>${s.minPrice}</td><td>${s.maxPrice}</td><td>${s.customPrice ?? `${s.minPrice}* (min)`}</td><td>${s.cost}</td><td>${["min", "max", "custom"].map((k) => s.scenarios[k].revenue).join(" / ")}</td><td>${["min", "max", "custom"].map((k) => s.scenarios[k].profit).join(" / ")}</td></tr>`;
        })
        .join(
          "",
        )}</tbody></table><p>Currency: BDT (৳). Total units: ${r.totalUnits}. Purchase cost: ${r.cost}. Additional expenses (calculation-level): ${r.expenses}.</p><table><thead><tr><th>Scenario</th><th>Revenue</th><th>Gross profit/loss</th><th>Net estimate</th><th>Margin</th><th>Markup</th></tr></thead><tbody>${["min", "max", "custom"].map((k) => `<tr><td>${k}</td><td>${r.scenarios[k].revenue}</td><td>${r.scenarios[k].profit}</td><td>${r.scenarios[k].net}</td><td>${r.scenarios[k].margin === null ? "N/A" : r.scenarios[k].margin + "%"}</td><td>${r.scenarios[k].markup === null ? "N/A" : r.scenarios[k].markup + "%"}</td></tr>`).join("")}</tbody></table><p>Buy, Min, Max and Custom columns show per-unit BDT prices. Custom prices fall back to minimum prices on lines without a custom price. Margin = gross profit ÷ revenue; markup = gross profit ÷ purchase cost. Zero denominator: N/A.</p><p>${escape(c.notes)}</p></body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:9px;width:100%;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: "15mm", bottom: "20mm", left: "12mm", right: "12mm" },
    });
  } finally {
    await browser.close();
  }
}
