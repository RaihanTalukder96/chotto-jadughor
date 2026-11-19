CREATE TYPE "ProductOrigin" AS ENUM ('IMPORTED', 'BANGLADESH');
ALTER TABLE "Product" ADD COLUMN "originType" "ProductOrigin", ADD COLUMN "importCountry" CHAR(2);
ALTER TABLE "Product" ADD CONSTRAINT "product_origin_valid" CHECK (
  ("originType" IS NULL AND "importCountry" IS NULL)
  OR ("originType" IS NOT NULL AND (
    ("originType" = 'BANGLADESH' AND "importCountry" IS NULL)
    OR ("originType" = 'IMPORTED' AND "importCountry" IS NOT NULL AND "importCountry" ~ '^[A-Z]{2}$' AND "importCountry" <> 'BD')
  ))
);
