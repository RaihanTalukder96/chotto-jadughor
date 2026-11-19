import { z } from "zod";
const normalized = (s: string) => s.normalize("NFKC").toLowerCase();
export const productOptionsSchema = z
  .array(
    z
      .object({
        name: z.string().trim().min(1).max(30),
        values: z
          .array(z.string().trim().min(1).max(50))
          .min(1)
          .max(20)
          .refine(
            (v) => new Set(v.map(normalized)).size === v.length,
            "Option values must be unique",
          ),
      })
      .strict(),
  )
  .max(3)
  .refine(
    (v) => new Set(v.map((g) => normalized(g.name))).size === v.length,
    "Option names must be unique",
  );
export const selectedOptionsSchema = z
  .record(z.string().min(1).max(30), z.string().min(1).max(50))
  .refine((v) => Object.keys(v).length <= 3, "Select at most three options");
export const optionKey = (values: unknown) =>
  JSON.stringify(
    Object.entries(selectedOptionsSchema.parse(values ?? {})).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );
export function validateSelection(
  options: unknown,
  selection: Record<string, string>,
) {
  const groups = productOptionsSchema.parse(options);
  selectedOptionsSchema
    .refine(
      (v) =>
        Object.keys(v).length === groups.length &&
        groups.every((g) => g.values.includes(v[g.name] ?? "")),
      "Choose the available product options before ordering. Open the product to update your selection.",
    )
    .parse(selection);
  return Object.fromEntries(groups.map((g) => [g.name, selection[g.name]!]));
}
