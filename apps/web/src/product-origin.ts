export type OriginInfo = {
  originType: "IMPORTED" | "BANGLADESH" | null;
  importCountry: string | null;
};
const countries = new Intl.DisplayNames(["en"], { type: "region" });
export function productOriginLabel(product: OriginInfo) {
  if (product.originType === "BANGLADESH") return "Made in Bangladesh";
  if (product.originType === "IMPORTED" && product.importCountry)
    return `Imported from ${countries.of(product.importCountry) ?? product.importCountry}`;
  return "";
}
