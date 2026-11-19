import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { fail } from "./security.js";
export const deleteProductSchema = z
  .object({ id: z.uuid(), version: z.number().int().positive() })
  .strict();
export const bulkDeleteSchema = z
  .object({ products: z.array(deleteProductSchema).min(1).max(100) })
  .strict()
  .refine(
    (b) => new Set(b.products.map((p) => p.id)).size === b.products.length,
    "Select each product once",
  );
export async function deleteProducts(
  products: z.infer<typeof deleteProductSchema>[],
  userId: string,
) {
  await db.$transaction(
    async (tx) => {
      const ids = products.map((p) => p.id);
      // Lock in a stable order, then update the whole selection in one statement.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
      );
      const result = await tx.product.updateMany({
        where: {
          deletedAt: null,
          OR: products.map((p) => ({ id: p.id, version: p.version })),
        },
        data: {
          deletedAt: new Date(),
          archived: true,
          published: false,
          featured: false,
          version: { increment: 1 },
        },
      });
      if (result.count !== products.length)
        fail(
          409,
          "A selected product changed or was already deleted. Refresh and select again. No products were deleted.",
        );
      const images = await tx.productImage.findMany({
        where: { productId: { in: ids } },
        select: { publicId: true },
      });
      if (images.length)
        await tx.assetCleanup.createMany({
          data: images.map((image) => ({ publicId: image.publicId })),
          skipDuplicates: true,
        });
      await tx.productImage.deleteMany({ where: { productId: { in: ids } } });
      await tx.auditLog.createMany({
        data: ids.map((entityId) => ({
          userId,
          action: "product.deleted",
          entityId,
        })),
      });
      // Retain the product tombstone for historical stock and pending order cancellations.
    },
    { timeout: 30000 },
  );
  return { ok: true, deleted: products.length };
}
