import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { reportPdf } from "../apps/api/src/pdf.js";
import { calculate, calculationSchema } from "../apps/api/src/domain.js";
// Deliberately synthetic QA fixture only; never seeds application data.
const products = Array.from({ length: 80 }, (_, i) => ({
  id: randomUUID(),
  productId: `QA-${i + 1}`,
  sku: `BANGLA-${i + 1}`,
  name: `শিশুর নরম পোশাক ও খেলনা - ছোট্ট জাদুঘর ${i + 1}`,
  stock: 50,
  buyingPrice: "100.10",
  minPrice: "150.30",
  maxPrice: "200.50",
}));
const input = calculationSchema.parse({
  title: "বাংলা প্রতিবেদন - Multi-page rendering verification",
  notes:
    "এটি বিক্রয় চালান নয়। এটি একটি আনুমানিক হিসাব।\nLong product names, repeated headers and Bengali conjunct shaping verification.",
  expenses: "150.55",
  items: products.map((p) => ({ productId: p.id, quantity: 2 })),
});
const results = calculate(input, products);
await mkdir(".local/qa", { recursive: true });
await writeFile(
  ".local/qa/bangla-multipage.pdf",
  await reportPdf({
    title: input.title,
    notes: input.notes,
    reportNumber: "CJ-QA-ONLY",
    createdAt: new Date(),
    preparedBy: "QA verifier",
    results,
    items: results.lines.map((snapshot) => ({ snapshot })),
  }),
);
console.log("Generated QA multi-page Bangla PDF.");
