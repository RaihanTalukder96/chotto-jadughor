import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { z } from "zod";
import { db } from "./db.js";
import { config } from "./config.js";
import { fail, requirePermission, type AuthRequest } from "./security.js";
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
  secure: true,
});
export const imageRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
});
export async function validateImage(buffer: Buffer) {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime))
    fail(400, "Only JPEG, PNG and WebP images are supported");
  return sharp(buffer, { limitInputPixels: 25000000, animated: false })
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
export async function cleanupAssets() {
  const queue = await db.assetCleanup.findMany({
    where: { createdAt: { lt: new Date(Date.now() - 10 * 60000) } },
    take: 50,
  });
  for (const item of queue) {
    if (await db.productImage.count({ where: { publicId: item.publicId } }))
      continue;
    const result = await cloudinary.uploader.destroy(item.publicId, {
      invalidate: true,
    });
    if (["ok", "not found"].includes(result.result))
      await db.assetCleanup.deleteMany({ where: { id: item.id } });
  }
}
imageRouter.post(
  "/:id/image",
  requirePermission("products.manage"),
  upload.single("image"),
  async (req, res) => {
    if (!config.CLOUDINARY_API_SECRET)
      fail(503, "Image storage is not configured");
    const id = z.uuid().parse(req.params.id);
    const version = z.coerce.number().int().positive().parse(req.body.version);
    if (!req.file) fail(400, "Select an image");
    if (!(await db.product.findUnique({ where: { id } })))
      fail(404, "Product not found");
    const bytes = await validateImage(req.file.buffer);
    const publicId = "chotto-jadughor/" + crypto.randomUUID();
    await db.assetCleanup.create({ data: { publicId } });
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          format: "webp",
          overwrite: false,
        },
        (error, result) => (error ? reject(error) : resolve(result!)),
      );
      stream.end(bytes);
    });
    await db.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id, version },
        data: { version: { increment: 1 } },
      });
      if (!updated.count) fail(409, "Product changed. Reload first");
      const old = await tx.productImage.findUnique({
        where: { productId: id },
      });
      await tx.productImage.upsert({
        where: { productId: id },
        create: {
          productId: id,
          publicId: result.public_id,
          url: result.secure_url,
          thumbnail: cloudinary.url(result.public_id, {
            secure: true,
            width: 480,
            height: 400,
            crop: "fill",
            quality: "auto",
            fetch_format: "auto",
          }),
        },
        update: {
          publicId: result.public_id,
          url: result.secure_url,
          thumbnail: cloudinary.url(result.public_id, {
            secure: true,
            width: 480,
            height: 400,
            crop: "fill",
            quality: "auto",
            fetch_format: "auto",
          }),
        },
      });
      await tx.assetCleanup.deleteMany({
        where: { publicId: result.public_id },
      });
      if (old)
        await tx.assetCleanup.upsert({
          where: { publicId: old.publicId },
          create: { publicId: old.publicId },
          update: {},
        });
      await tx.auditLog.create({
        data: {
          userId: (req as AuthRequest).auth.user.id,
          action: "product.image-updated",
          entityId: id,
        },
      });
    });
    res.status(201).json({ ok: true });
  },
);
imageRouter.delete(
  "/:id/image",
  requirePermission("products.manage"),
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const version = z
      .object({ version: z.number().int().positive() })
      .strict()
      .parse(req.body).version;
    await db.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id, version },
        data: { version: { increment: 1 } },
      });
      if (!updated.count) fail(409, "Product changed. Reload first");
      const image = await tx.productImage.findUnique({
        where: { productId: id },
      });
      if (image) {
        await tx.productImage.delete({ where: { id: image.id } });
        await tx.assetCleanup.upsert({
          where: { publicId: image.publicId },
          create: { publicId: image.publicId },
          update: {},
        });
      }
      await tx.auditLog.create({
        data: {
          userId: (req as AuthRequest).auth.user.id,
          action: "product.image-removed",
          entityId: id,
        },
      });
    });
    res.json({ ok: true });
  },
);
