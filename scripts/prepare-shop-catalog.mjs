// Operator-requested starter catalog. Reruns add missing drafts only, never overwrite edits.
import "../apps/api/environment.mjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresRuntimeUrl } from "../apps/api/dist/postgres.js";
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: postgresRuntimeUrl(process.env.DATABASE_URL),
  }),
});
const catalog = [
  [
    "Baby Clothing",
    [
      [
        "Bodysuits & Sets",
        [
          ["Cotton Bodysuit · Cream", "0–3 months", 450],
          ["Everyday Two-piece Set", "3–6 months", 690],
        ],
      ],
      [
        "Caps, Mittens & Socks",
        [
          ["Newborn Cap & Mitten Set", "Newborn", 290],
          ["Soft Baby Socks · 3 pairs", "0–6 months", 250],
        ],
      ],
    ],
  ],
  [
    "Toys & Play",
    [
      [
        "Rattles & Teethers",
        [
          ["Easy-grip Baby Rattle", "3 months+", 350],
          ["Textured Teether Ring", "See manufacturer age guidance", 390],
        ],
      ],
      [
        "Soft & Learning Toys",
        [
          ["Soft Cloth Activity Book", "Supervised play", 550],
          ["Stacking Cups · 8 pieces", "6 months+", 490],
        ],
      ],
    ],
  ],
  [
    "Baby Skincare",
    [
      [
        "Lotions & Creams",
        [
          ["Baby Moisturising Lotion · 200ml", "Check product label", 650],
          ["Baby Care Cream · 100ml", "Check product label", 490],
        ],
      ],
      [
        "Baby Oils & Wipes",
        [
          ["Baby Massage Oil · 100ml", "Check product label", 390],
          ["Baby Wet Wipes · 80 pieces", "Check product label", 220],
        ],
      ],
    ],
  ],
  [
    "Bath & Grooming",
    [
      [
        "Wash & Shampoo",
        [
          ["Baby Hair & Body Wash · 200ml", "Check product label", 590],
          ["Baby Shampoo · 200ml", "Check product label", 550],
        ],
      ],
      [
        "Towels & Grooming",
        [
          ["Hooded Baby Towel", "75 × 75 cm", 790],
          ["Baby Brush & Comb Set", "Use with adult care", 320],
        ],
      ],
    ],
  ],
  [
    "Feeding Essentials",
    [
      [
        "Bottles & Cleaning",
        [
          [
            "Baby Feeding Bottle · 150ml",
            "Confirm nipple flow before use",
            690,
          ],
          ["Bottle & Nipple Brush Set", "Cleaning accessory", 290],
        ],
      ],
      [
        "Bibs & Tableware",
        [
          ["Easy-clean Baby Bib", "Adjustable fit", 350],
          ["Baby Bowl & Spoon Set", "6 months+", 550],
        ],
      ],
    ],
  ],
  [
    "Diapers & Changing",
    [
      [
        "Baby Diapers",
        [
          [
            "Baby Diapers · Small · 24 pieces",
            "Confirm weight range on pack",
            650,
          ],
          [
            "Baby Diaper Pants · Medium · 24 pieces",
            "Confirm weight range on pack",
            750,
          ],
        ],
      ],
      [
        "Changing Essentials",
        [
          ["Portable Changing Mat", "60 × 40 cm", 490],
          ["Diaper Storage Caddy", "Nursery organizer", 1190],
        ],
      ],
    ],
  ],
  [
    "Travel & Accessories",
    [
      [
        "Out & About",
        [
          ["Baby Essentials Travel Bag", "Parent accessory", 1490],
          ["Stroller Organizer", "Check compatibility before use", 850],
        ],
      ],
      [
        "Nursery Accessories",
        [
          ["Cotton Muslin Swaddle", "100 × 100 cm", 650],
          ["Baby Mosquito Net", "Use under adult supervision", 790],
        ],
      ],
    ],
  ],
  [
    "Mom Care",
    [
      [
        "Nursing Essentials",
        [
          ["Nursing Cover", "Parent accessory", 790],
          ["Reusable Nursing Pads · 3 pairs", "Parent accessory", 490],
        ],
      ],
      [
        "Everyday Comfort",
        [
          ["Maternity Essentials Pouch", "Parent accessory", 450],
          ["Mom & Baby Travel Organizer", "Parent accessory", 990],
        ],
      ],
    ],
  ],
];
let added = 0,
  existing = 0;
try {
  await db.$transaction(
    async (tx) => {
      for (const [ci, [name, subs]] of catalog.entries()) {
        const category = await tx.category.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        for (const [si, [subname, products]] of subs.entries()) {
          const sub = await tx.subcategory.upsert({
            where: {
              categoryId_name: { categoryId: category.id, name: subname },
            },
            create: { categoryId: category.id, name: subname },
            update: {},
          });
          for (const [
            pi,
            [productName, ageRange, suggestedPrice],
          ] of products.entries()) {
            const sku = `CJ-STARTER-${ci + 1}${si + 1}${pi + 1}`;
            if (await tx.product.findUnique({ where: { sku } })) {
              existing++;
              continue;
            }
            const p = await tx.product.create({
              data: {
                sku,
                productId: sku,
                name: productName,
                categoryId: category.id,
                subcategoryId: sub.id,
                description: `${productName}. A starter listing for the Chotto Jadughor collection. Final brand, materials, size and care details will be confirmed before publication.`,
                specifications:
                  "DRAFT — Operator review required. Add the actual supplier/brand, materials/ingredients, manufacturer guidance, expiry/batch details where applicable and a real product photo. Suggested customer price is provisional. Set actual buying price and stock before publishing.",
                ageRange,
                buyingPrice: "0",
                minPrice: String(suggestedPrice),
                maxPrice: String(suggestedPrice),
                retailPrice: String(suggestedPrice),
                stock: 0,
                published: false,
                featured: false,
              },
            });
            await tx.auditLog.create({
              data: { action: "shop.starter-draft.created", entityId: p.id },
            });
            added++;
          }
        }
      }
      await tx.storeSettings.upsert({
        where: { id: "main" },
        create: { id: "main" },
        update: {},
      });
    },
    { timeout: 60000 },
  );
  console.log(
    JSON.stringify({
      categories: catalog.length,
      subcategories: 16,
      draftsAdded: added,
      existingSkipped: existing,
      publicProductsPublished: 0,
      stockInvented: false,
    }),
  );
} finally {
  await db.$disconnect();
}
