ALTER TABLE "Product" ADD CONSTRAINT "product_amounts_nonnegative" CHECK ("buyingPrice" >= 0 AND "minPrice" >= 0 AND "maxPrice" >= "minPrice");
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_nonnegative" CHECK (stock >= 0 AND "lowStockThreshold" >= 0 AND version > 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_nonblank" CHECK (length(trim(name)) > 0 AND length(trim(sku)) > 0 AND length(trim("productId")) > 0);
ALTER TABLE "Calculation" ADD CONSTRAINT "expenses_nonnegative" CHECK (expenses >= 0);
ALTER TABLE "RolePermission" ADD CONSTRAINT "fixed_role_permissions" CHECK (role <> 'ADMIN' AND permission IN ('dashboard.read','products.read','products.manage','calculations.use','reports.export'));
