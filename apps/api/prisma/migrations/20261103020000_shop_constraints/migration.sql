ALTER TABLE "RolePermission" DROP CONSTRAINT "fixed_role_permissions";
ALTER TABLE "RolePermission" ADD CONSTRAINT "fixed_role_permissions" CHECK (
  role <> 'ADMIN' AND permission IN ('dashboard.read','products.read','products.manage','calculations.use','reports.export','orders.manage')
);
ALTER TABLE "Product" ADD CONSTRAINT "storefront_prices_valid" CHECK (
  ("retailPrice" IS NULL OR "retailPrice" >= 0)
  AND (NOT published OR ("retailPrice" IS NOT NULL AND "retailPrice" > 0))
  AND ("salePrice" IS NULL OR ("retailPrice" IS NOT NULL AND "salePrice" > 0 AND "salePrice" < "retailPrice"))
);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "delivery_prices_valid" CHECK (
  ("dhakaDelivery" IS NULL OR "dhakaDelivery" >= 0)
  AND ("outsideDelivery" IS NULL OR "outsideDelivery" >= 0)
);
ALTER TABLE "ShopOrder" ADD CONSTRAINT "order_totals_valid" CHECK (
  subtotal >= 0 AND delivery >= 0 AND total = subtotal + delivery AND version > 0 AND zone IN ('DHAKA','OUTSIDE')
);
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "order_lines_valid" CHECK (
  quantity > 0 AND "unitPrice" > 0 AND "lineTotal" = quantity * "unitPrice"
);
