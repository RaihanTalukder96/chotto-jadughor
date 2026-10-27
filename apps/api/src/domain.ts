import { z } from "zod";
import { Decimal } from "decimal.js";
export const money = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,10})(\.\d{1,2})?$/,
    "Use a non-negative amount with at most two decimal places",
  );
export const strongPassword = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/\d/)
  .regex(/[^A-Za-z0-9]/);
export const username = z.string().trim().min(1).max(80);
export const normalize = (s: string) =>
  s.trim().normalize("NFKC").toLowerCase();
export const menus = {
  Dashboard: ["dashboard.read"],
  "Manage Product": ["products.read", "products.manage"],
  "Profit Calculation": ["calculations.use", "reports.export"],
} as const;
export const allPermissions = [
  ...Object.values(menus).flat(),
  "permissions.manage",
  "users.manage",
];
export const productSchema = z
  .object({
    productId: z.string().trim().min(1).max(50),
    sku: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(200),
    categoryId: z.uuid(),
    description: z.string().max(3000).default(""),
    buyingPrice: money,
    minPrice: money,
    maxPrice: money,
    stock: z.number().int().min(0).max(100000000),
    lowStockThreshold: z.number().int().min(0).max(100000000),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((v) => new Decimal(v.maxPrice).gte(v.minPrice), {
    message: "Maximum price must be at least minimum price",
    path: ["maxPrice"],
  });
export const calculationSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    notes: z.string().max(3000).default(""),
    expenses: money.default("0"),
    sourceId: z.uuid().optional(),
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            quantity: z.number().int().positive().max(1000000),
            customPrice: money.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    { message: "Select each product only once" },
  );
type PriceProduct = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  stock: number;
  buyingPrice: { toString(): string };
  minPrice: { toString(): string };
  maxPrice: { toString(): string };
};
export function calculate(
  input: z.infer<typeof calculationSchema>,
  products: PriceProduct[],
) {
  const lines = input.items.map((i) => {
    const p = products.find((p) => p.id === i.productId);
    if (!p) throw new Error("One or more products are archived or unavailable");
    const cost = new Decimal(p.buyingPrice.toString()).mul(i.quantity);
    const scenarios = Object.fromEntries(
      ["min", "max", "custom"].map((key) => {
        const price =
          key === "custom"
            ? (i.customPrice ?? p.minPrice.toString())
            : key === "min"
              ? p.minPrice.toString()
              : p.maxPrice.toString();
        const revenue = new Decimal(price).mul(i.quantity);
        return [
          key,
          {
            price: new Decimal(price).toFixed(2),
            revenue: revenue.toFixed(2),
            profit: revenue.minus(cost).toFixed(2),
          },
        ];
      }),
    );
    return {
      id: p.id,
      productId: p.productId,
      sku: p.sku,
      name: p.name,
      quantity: i.quantity,
      buyingPrice: p.buyingPrice.toString(),
      minPrice: p.minPrice.toString(),
      maxPrice: p.maxPrice.toString(),
      customPrice: i.customPrice ?? null,
      customFallback: i.customPrice === undefined,
      cost: cost.toFixed(2),
      scenarios,
      warnings: [
        ...(i.quantity > p.stock ? ["Quantity exceeds current stock"] : []),
        ...(i.customPrice !== undefined &&
        (new Decimal(i.customPrice).lt(p.minPrice.toString()) ||
          new Decimal(i.customPrice).gt(p.maxPrice.toString()))
          ? ["Custom price outside selling range"]
          : []),
      ],
    };
  });
  const cost = Decimal.sum(...lines.map((l) => l.cost));
  const scenarios = Object.fromEntries(
    ["min", "max", "custom"].map((key) => {
      const revenue = Decimal.sum(
        ...lines.map((l) => l.scenarios[key]!.revenue),
      );
      const profit = revenue.minus(cost);
      return [
        key,
        {
          revenue: revenue.toFixed(2),
          profit: profit.toFixed(2),
          net: profit.minus(input.expenses).toFixed(2),
          margin: revenue.isZero()
            ? null
            : profit.div(revenue).mul(100).toFixed(2),
          markup: cost.isZero() ? null : profit.div(cost).mul(100).toFixed(2),
        },
      ];
    }),
  );
  return {
    lines,
    totalUnits: lines.reduce((n, l) => n + l.quantity, 0),
    cost: cost.toFixed(2),
    expenses: new Decimal(input.expenses).toFixed(2),
    scenarios,
  };
}
