-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ageRange" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brand" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retailPrice" DECIMAL(14,2),
ADD COLUMN     "salePrice" DECIMAL(14,2),
ADD COLUMN     "specifications" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "acceptingOrders" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "dhakaDelivery" DECIMAL(14,2),
    "outsideDelivery" DECIMAL(14,2),
    "deliveryInfo" TEXT NOT NULL DEFAULT '',
    "returnPolicy" TEXT NOT NULL DEFAULT '',
    "privacyPolicy" TEXT NOT NULL DEFAULT '',
    "announcement" TEXT NOT NULL DEFAULT 'Safe for baby. Easy for parents. Honest price.',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "trackingHash" TEXT NOT NULL,
    "customerId" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "delivery" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_orderNumber_key" ON "ShopOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_requestKey_key" ON "ShopOrder"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_trackingHash_key" ON "ShopOrder"("trackingHash");

-- CreateIndex
CREATE INDEX "ShopOrder_customerId_createdAt_idx" ON "ShopOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopOrder_status_createdAt_idx" ON "ShopOrder"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
