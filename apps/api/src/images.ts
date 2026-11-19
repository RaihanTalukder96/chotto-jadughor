import { Router, type Request, type Response } from "express";
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
  limits: { fileSize: 5 * 1024 * 1024, files: 4, fields: 1, parts: 5 },
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
async function saveImages(req: Request, res: Response, append: boolean) {
  if (!config.CLOUDINARY_API_SECRET)
    fail(503, "Image storage is not configured");
  const id = z.uuid().parse(req.params.id);
  const version = z.coerce.number().int().positive().parse(req.body.version);
  const files = req.file
    ? [req.file]
    : ((req.files as Express.Multer.File[] | undefined) ?? []);
  if (!files.length) fail(400, "Select at least one image");
  const product = await db.product.findUnique({
    where: { id },
    include: { images: { orderBy: { position: "asc" } } },
  });
  if (!product) fail(404, "Product not found");
  if (product.version !== version) fail(409, "Product changed. Reload first");
  if (append && product.images.length + files.length > 4)
    fail(400, "A product can have at most 4 images");
  const imageId = req.params.imageId
    ? z.uuid().parse(req.params.imageId)
    : undefined;
  const replacing = append
    ? undefined
    : imageId
      ? product.images.find((i) => i.id === imageId)
      : product.images[0];
  if (imageId && !replacing) fail(404, "Product image not found");
  const validated: Buffer[] = [];
  for (const file of files) validated.push(await validateImage(file.buffer));
  const uploaded: { publicId: string; url: string; thumbnail: string }[] = [];
  for (const bytes of validated) {
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
    uploaded.push({
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
    });
  }
  const images = await db.$transaction(async (tx) => {
    const changed = await tx.product.updateMany({
      where: { id, version },
      data: { version: { increment: 1 } },
    });
    if (!changed.count) fail(409, "Product changed. Reload first");
    const current = await tx.productImage.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });
    if (append && current.length + uploaded.length > 4)
      fail(400, "A product can have at most 4 images");
    if (replacing) {
      await tx.productImage.delete({ where: { id: replacing.id } });
      await tx.assetCleanup.upsert({
        where: { publicId: replacing.publicId },
        create: { publicId: replacing.publicId },
        update: {},
      });
    }
    for (const [index, image] of uploaded.entries()) {
      const position = replacing
        ? replacing.position
        : append
          ? current.length + index
          : 0;
      await tx.productImage.create({
        data: { ...image, productId: id, position },
      });
      await tx.assetCleanup.deleteMany({ where: { publicId: image.publicId } });
    }
    await tx.auditLog.create({
      data: {
        userId: (req as AuthRequest).auth.user.id,
        action: append ? "product.images-added" : "product.image-updated",
        entityId: id,
      },
    });
    return tx.productImage.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });
  });
  res.status(201).json({ ok: true, version: version + 1, images });
}
imageRouter.post(
  "/:id/images",
  requirePermission("products.manage"),
  upload.array("images", 4),
  (req, res) => saveImages(req, res, true),
);
imageRouter.post(
  "/:id/image",
  requirePermission("products.manage"),
  upload.single("image"),
  (req, res) => saveImages(req, res, false),
);
imageRouter.post(
  "/:id/images/:imageId",
  requirePermission("products.manage"),
  upload.single("image"),
  (req, res) => saveImages(req, res, false),
);
async function changeGallery(req: Request, res: Response, cover: boolean) {
  const id = z.uuid().parse(req.params.id);
  const imageId = req.params.imageId
    ? z.uuid().parse(req.params.imageId)
    : undefined;
  const { version } = z
    .object({ version: z.number().int().positive() })
    .strict()
    .parse(req.body);
  const images = await db.$transaction(async (tx) => {
    const changed = await tx.product.updateMany({
      where: { id, version },
      data: { version: { increment: 1 } },
    });
    if (!changed.count) fail(409, "Product changed. Reload first");
    const all = await tx.productImage.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });
    const target = imageId ? all.find((i) => i.id === imageId) : all[0];
    if (imageId && !target) fail(404, "Product image not found");
    const remaining = all.filter((i) => i.id !== target?.id);
    if (cover && target) remaining.unshift(target);
    if (!cover && target)
      await tx.assetCleanup.upsert({
        where: { publicId: target.publicId },
        create: { publicId: target.publicId },
        update: {},
      });
    // Reinsert the tiny gallery atomically to avoid unique-position conflicts on swaps.
    await tx.productImage.deleteMany({ where: { productId: id } });
    if (remaining.length)
      await tx.productImage.createMany({
        data: remaining.map((image, position) => ({ ...image, position })),
      });
    await tx.auditLog.create({
      data: {
        userId: (req as AuthRequest).auth.user.id,
        action: cover ? "product.image-cover-changed" : "product.image-removed",
        entityId: id,
      },
    });
    return tx.productImage.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });
  });
  res.json({ ok: true, version: version + 1, images });
}
imageRouter.delete(
  "/:id/images/:imageId",
  requirePermission("products.manage"),
  (req, res) => changeGallery(req, res, false),
);
imageRouter.delete(
  "/:id/image",
  requirePermission("products.manage"),
  (req, res) => changeGallery(req, res, false),
);
imageRouter.patch(
  "/:id/images/:imageId/cover",
  requirePermission("products.manage"),
  (req, res) => changeGallery(req, res, true),
);
