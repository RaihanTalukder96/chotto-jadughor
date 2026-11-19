ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
