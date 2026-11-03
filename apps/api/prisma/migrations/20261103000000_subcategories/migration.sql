CREATE TABLE "Subcategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");
CREATE UNIQUE INDEX "Subcategory_id_categoryId_key" ON "Subcategory"("id", "categoryId");
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD COLUMN "subcategoryId" UUID;
CREATE INDEX "Product_subcategoryId_categoryId_idx" ON "Product"("subcategoryId", "categoryId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_categoryId_fkey" FOREIGN KEY ("subcategoryId", "categoryId") REFERENCES "Subcategory"("id", "categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
