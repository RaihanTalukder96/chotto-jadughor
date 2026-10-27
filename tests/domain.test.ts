import { describe, it, expect } from "vitest";
import {
  calculate,
  calculationSchema,
  productSchema,
  normalize,
} from "../apps/api/src/domain.js";
const id = "a5e1eb66-41ac-4b6e-98fe-c79ae186fd0e";
const p = {
  id,
  productId: "CJ-1",
  sku: "BABY-1",
  name: "শিশুর পোশাক",
  stock: 3,
  buyingPrice: "0.10",
  minPrice: "0.30",
  maxPrice: "0.50",
};
const input = (items: any[] = [{ productId: id, quantity: 3 }]) =>
  calculationSchema.parse({ title: "Estimate", expenses: "0.01", items });
describe("Authoritative decimal estimates", () => {
  it("avoids floating point errors and applies expenses only at calculation level", () => {
    const r = calculate(input(), [p]);
    expect(r.cost).toBe("0.30");
    expect(r.scenarios.min?.revenue).toBe("0.90");
    expect(r.scenarios.min?.net).toBe("0.59");
    expect(r.scenarios.min?.margin).toBe("66.67");
    expect(r.scenarios.min?.markup).toBe("200.00");
    expect(r.lines[0]?.customFallback).toBe(true);
  });
  it("handles zero denominators and losses", () => {
    const r = calculate(input(), [
      { ...p, buyingPrice: "0", minPrice: "0", maxPrice: "0" },
    ]);
    expect(r.scenarios.min?.margin).toBeNull();
    expect(r.scenarios.min?.markup).toBeNull();
    expect(r.scenarios.min?.net).toBe("-0.01");
  });
  it("warns on out-of-stock and out-of-range quantities without changing inventory", () => {
    const r = calculate(
      input([{ productId: id, quantity: 4, customPrice: "0.01" }]),
      [p],
    );
    expect(r.lines[0]?.warnings).toHaveLength(2);
    expect(r.scenarios.custom?.profit).toBe("-0.36");
    expect(p.stock).toBe(3);
  });
  it("rejects tampered prices/totals, duplicate lines and fractional quantities", () => {
    expect(() =>
      input([{ productId: id, quantity: 1, buyingPrice: "0" }]),
    ).toThrow();
    expect(() => calculationSchema.parse({ ...input(), total: "0" })).toThrow();
    expect(() =>
      input([
        { productId: id, quantity: 1 },
        { productId: id, quantity: 1 },
      ]),
    ).toThrow();
    expect(() => input([{ productId: id, quantity: 0.5 }])).toThrow();
  });
  it("validates product prices and keeps loss-making products valid", () => {
    const data = {
      productId: "CJ-1",
      sku: "CJ-1",
      name: "Baby",
      categoryId: id,
      stock: 0,
      lowStockThreshold: 5,
      buyingPrice: "10",
      minPrice: "1",
      maxPrice: "2",
    };
    expect(productSchema.safeParse(data).success).toBe(true);
    for (const patch of [
      { minPrice: "1.001" },
      { stock: -1 },
      { maxPrice: "0" },
      { sku: " " },
    ])
      expect(productSchema.safeParse({ ...data, ...patch }).success).toBe(
        false,
      );
  });
  it("normalizes usernames consistently while preserving spaces", () =>
    expect(normalize("  STORE Manager  ")).toBe("store manager"));
});
