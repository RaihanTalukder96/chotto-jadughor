ALTER TABLE "Product" ADD COLUMN "options" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ShopOrderItem" ADD COLUMN "selectedOptions" JSONB NOT NULL DEFAULT '{}';
DROP INDEX "ProductImage_productId_key";
ALTER TABLE "ProductImage" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "ProductImage"("productId", "position");
ALTER TABLE "ProductImage" ADD CONSTRAINT "product_image_position_valid" CHECK (position BETWEEN 0 AND 3);
