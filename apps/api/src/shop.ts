import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { Decimal } from "decimal.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db.js";
import {
  selectedOptionsSchema,
  optionKey,
  validateSelection,
} from "./product-options.js";
import { production } from "./config.js";
import { money, strongPassword } from "./domain.js";
import {
  authenticate,
  csrf,
  requirePermission,
  fail,
  hashToken,
  token,
  passwordHash,
  cookieOptions,
  type AuthRequest,
} from "./security.js";

export const shop = Router();
export const commerce = Router();
const csrfCookie = production ? "__Host-cj_shop_csrf" : "cj_shop_csrf";
const sessionCookie = production ? "__Host-cj_customer" : "cj_customer";
const publicCustomer = (c: { id: string; name: string; email: string }) => ({
  id: c.id,
  name: c.name,
  email: c.email,
});
async function customer(req: Request) {
  const raw = req.cookies[sessionCookie];
  if (typeof raw !== "string" || raw.length !== 64) return null;
  const session = await db.customerSession.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { customer: true },
  });
  return session && session.expiresAt > new Date() ? session.customer : null;
}
async function signIn(
  id: string,
  expectedHash: string,
  req: Request,
  res: Response,
) {
  const old = req.cookies[sessionCookie];
  if (typeof old === "string")
    await db.customerSession.deleteMany({
      where: { tokenHash: hashToken(old) },
    });
  const raw = token();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id}::uuid FOR UPDATE`;
    const current = await tx.customer.findUnique({ where: { id } });
    if (!current || current.passwordHash !== expectedHash)
      fail(401, "Please sign in again");
    await tx.customerSession.create({
      data: {
        customerId: id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  });
  res.cookie(sessionCookie, raw, { ...cookieOptions, maxAge: 7 * 86400000 });
}
shop.get("/session", async (req, res) => {
  const raw = token();
  // Reuse an existing token so multiple browser tabs can submit independently.
  const csrfToken =
    typeof req.cookies[csrfCookie] === "string" &&
    /^[a-f0-9]{64}$/.test(req.cookies[csrfCookie])
      ? req.cookies[csrfCookie]
      : raw;
  res.cookie(csrfCookie, csrfToken, { ...cookieOptions, maxAge: 7 * 86400000 });
  const c = await customer(req);
  res.json({ csrf: csrfToken, customer: c ? publicCustomer(c) : null });
});
shop.use((req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const header = req.get("X-CSRF-Token"),
    cookie = req.cookies[csrfCookie];
  if (
    typeof header !== "string" ||
    typeof cookie !== "string" ||
    !/^[a-f0-9]{64}$/.test(header) ||
    !/^[a-f0-9]{64}$/.test(cookie) ||
    !timingSafeEqual(Buffer.from(header), Buffer.from(cookie))
  )
    fail(403, "Refresh the shop and try again");
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const orderLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const email = z.email().trim().toLowerCase().max(254);
const dummyHash = passwordHash("Dummy-Customer-Password-42!");
shop.post("/register", authLimit, async (req, res) => {
  const b = z
    .object({
      name: z.string().trim().min(2).max(100),
      email,
      password: strongPassword,
    })
    .strict()
    .parse(req.body);
  // Registration never changes an existing account or attaches guest orders by email.
  const exists = await db.customer.findUnique({ where: { email: b.email } });
  if (exists)
    fail(409, "Unable to create this account. Try signing in instead.");
  const c = await db.customer.create({
    data: {
      name: b.name,
      email: b.email,
      passwordHash: await passwordHash(b.password),
    },
  });
  await signIn(c.id, c.passwordHash, req, res);
  res.status(201).json(publicCustomer(c));
});
shop.post("/login", authLimit, async (req, res) => {
  const b = z
    .object({ email, password: z.string().min(1).max(128) })
    .strict()
    .parse(req.body);
  const c = await db.customer.findUnique({ where: { email: b.email } });
  const valid = await argon2.verify(
    c?.passwordHash ?? (await dummyHash),
    b.password,
  );
  if (!c || !valid) fail(401, "Email or password is incorrect");
  await signIn(c.id, c.passwordHash, req, res);
  res.json(publicCustomer(c));
});
shop.post("/logout", async (req, res) => {
  const raw = req.cookies[sessionCookie];
  if (typeof raw === "string")
    await db.customerSession.deleteMany({
      where: { tokenHash: hashToken(raw) },
    });
  res.clearCookie(sessionCookie, cookieOptions).json({ ok: true });
});
shop.post("/password", authLimit, async (req, res) => {
  const c = await customer(req);
  if (!c) fail(401, "Please sign in");
  const b = z
    .object({ currentPassword: z.string().max(128), password: strongPassword })
    .strict()
    .parse(req.body);
  if (!(await argon2.verify(c.passwordHash, b.currentPassword)))
    fail(400, "Current password is incorrect");
  await db.$transaction([
    db.customer.update({
      where: { id: c.id },
      data: { passwordHash: await passwordHash(b.password) },
    }),
    db.customerSession.deleteMany({ where: { customerId: c.id } }),
  ]);
  res.clearCookie(sessionCookie, cookieOptions).json({ ok: true });
});
const settings = () =>
  db.storeSettings.upsert({
    where: { id: "main" },
    create: { id: "main" },
    update: {},
  });
shop.get("/settings", async (_req, res) => {
  res.json(await settings());
});
shop.get("/categories", async (_req, res) => {
  res.json(
    await db.category.findMany({
      orderBy: { name: "asc" },
      include: { subcategories: { orderBy: { name: "asc" } } },
    }),
  );
});
const select = {
  id: true,
  sku: true,
  name: true,
  description: true,
  retailPrice: true,
  salePrice: true,
  featured: true,
  brand: true,
  ageRange: true,
  specifications: true,
  category: true,
  subcategory: true,
  images: {
    orderBy: { position: "asc" as const },
    select: { url: true, thumbnail: true },
  },
  options: true,
  stock: true,
} as const;
const visible: Prisma.ProductWhereInput = {
  published: true,
  archived: false,
  retailPrice: { gt: 0 },
};
shop.get("/products", async (req, res) => {
  const q = z
    .object({
      search: z.string().max(100).default(""),
      categoryId: z.uuid().optional(),
      subcategoryId: z.uuid().optional(),
      brand: z.string().max(100).optional(),
      sale: z.enum(["true"]).optional(),
      featured: z.enum(["true"]).optional(),
      sort: z
        .enum(["newest", "price-asc", "price-desc", "name"])
        .default("newest"),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(12),
      min: money.optional(),
      max: money.optional(),
    })
    .parse(req.query);
  const clauses: Prisma.ProductWhereInput[] = [
    visible,
    {
      OR: ["name", "sku", "brand"].map((field) => ({
        [field]: { contains: q.search, mode: "insensitive" },
      })),
    },
  ];
  if (q.categoryId) clauses.push({ categoryId: q.categoryId });
  if (q.subcategoryId) clauses.push({ subcategoryId: q.subcategoryId });
  if (q.brand) clauses.push({ brand: q.brand });
  if (q.featured) clauses.push({ featured: true });
  if (q.sale) clauses.push({ salePrice: { not: null } });
  // Effective prices are queried in SQL, with only fixed sort fragments and bound values.
  const where: Prisma.ProductWhereInput = { AND: clauses };
  // Bound the candidate query; price filtering/sorting uses Prisma's parameterized SQL below.
  const price = Prisma.sql`COALESCE(p."salePrice",p."retailPrice")`;
  const search = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
  const filters = Prisma.sql`p.published=true AND p.archived=false AND p."retailPrice">0 AND (p.name ILIKE ${search} OR p.sku ILIKE ${search} OR p.brand ILIKE ${search}) ${q.categoryId ? Prisma.sql`AND p."categoryId"=${q.categoryId}::uuid` : Prisma.empty} ${q.subcategoryId ? Prisma.sql`AND p."subcategoryId"=${q.subcategoryId}::uuid` : Prisma.empty} ${q.brand ? Prisma.sql`AND p.brand=${q.brand}` : Prisma.empty} ${q.sale ? Prisma.sql`AND p."salePrice" IS NOT NULL` : Prisma.empty} ${q.featured ? Prisma.sql`AND p.featured=true` : Prisma.empty} ${q.min ? Prisma.sql`AND ${price}>=${q.min}::numeric` : Prisma.empty} ${q.max ? Prisma.sql`AND ${price}<=${q.max}::numeric` : Prisma.empty}`;
  const order =
    q.sort === "price-asc"
      ? Prisma.sql`${price} ASC,p.id`
      : q.sort === "price-desc"
        ? Prisma.sql`${price} DESC,p.id`
        : q.sort === "name"
          ? Prisma.sql`p.name ASC,p.id`
          : Prisma.sql`p."createdAt" DESC,p.id`;
  const [ids, counts, brands] = await Promise.all([
    db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT p.id FROM "Product" p WHERE ${filters} ORDER BY ${order} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    ),
    db.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT count(*) AS total FROM "Product" p WHERE ${filters}`,
    ),
    db.product.findMany({
      where: { ...visible, brand: { not: "" } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
  ]);
  const products = await db.product.findMany({
    where: { AND: [where, { id: { in: ids.map((i) => i.id) } }] },
    select,
  });
  const total = Number(counts[0]!.total);
  res.json({
    items: ids.map((i) => products.find((p) => p.id === i.id)).filter(Boolean),
    total,
    pages: Math.ceil(total / q.limit),
    page: q.page,
    brands: brands.map((b) => b.brand),
  });
});
shop.get("/products/:id", async (req, res) => {
  const p = await db.product.findFirst({
    where: { ...visible, id: z.uuid().parse(req.params.id) },
    select,
  });
  if (!p) fail(404, "This product is not available");
  res.json(p);
});
const cartSchema = z
  .object({
    zone: z.enum(["DHAKA", "OUTSIDE"]),
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(50),
            selectedOptions: selectedOptionsSchema.default({}),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.items.map((i) => i.productId + optionKey(i.selectedOptions)))
        .size === v.items.length,
    "Each product option combination must appear once",
  );
type Cart = z.infer<typeof cartSchema>;
async function quote(tx: Prisma.TransactionClient, cart: Cart) {
  const config = await tx.storeSettings.findUnique({ where: { id: "main" } });
  if (!config?.acceptingOrders)
    fail(503, "We are preparing our shop. Orders will open soon.");
  const delivery =
    cart.zone === "DHAKA" ? config.dhakaDelivery : config.outsideDelivery;
  if (delivery === null) fail(503, "Delivery pricing is not configured");
  const products = await tx.product.findMany({
    where: { ...visible, id: { in: cart.items.map((i) => i.productId) } },
    select,
  });
  const lines = cart.items.map((i) => {
    const p = products.find((p) => p.id === i.productId);
    if (!p || !p.retailPrice)
      fail(409, "A product is no longer available. Please update your cart.");
    const requested = cart.items
      .filter((line) => line.productId === p.id)
      .reduce((sum, line) => sum + line.quantity, 0);
    if (p.stock < requested)
      fail(
        409,
        `${p.name}: only ${p.stock} available across all selected options`,
      );
    const selectedOptions = validateSelection(p.options, i.selectedOptions);
    const price = new Decimal((p.salePrice ?? p.retailPrice).toString());
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      quantity: i.quantity,
      selectedOptions,
      unitPrice: price.toFixed(2),
      lineTotal: price.mul(i.quantity).toFixed(2),
    };
  });
  const subtotal = Decimal.sum(...lines.map((i) => i.lineTotal));
  if (subtotal.add(delivery.toString()).gt("999999999999.99"))
    fail(
      400,
      "Order total exceeds the supported limit. Please split the order.",
    );
  return {
    lines,
    subtotal: subtotal.toFixed(2),
    delivery: delivery.toString(),
    total: subtotal.add(delivery.toString()).toFixed(2),
  };
}
shop.post("/quote", async (req, res) => {
  res.json(
    await db.$transaction((tx) => quote(tx, cartSchema.parse(req.body))),
  );
});
const checkoutSchema = z
  .object({
    cart: cartSchema,
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .regex(
        /^(?:\+?88)?01[3-9]\d{8}$/,
        "Enter a valid Bangladesh mobile number",
      ),
    email: z.union([email, z.literal("")]).default(""),
    address: z.string().trim().min(10).max(500),
    district: z.string().trim().min(2).max(80),
    notes: z.string().trim().max(500).default(""),
    expectedTotal: money,
    requestKey: z.uuid(),
    trackingToken: z.string().regex(/^[a-f0-9]{64}$/),
    acceptPolicies: z.literal(true),
  })
  .strict();
async function serial<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (
        attempt < 2 &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034"
      )
        continue;
      throw e;
    }
  }
}
const receipt = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  delivery: true,
  total: true,
  createdAt: true,
  items: {
    select: {
      name: true,
      sku: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      selectedOptions: true,
    },
  },
} as const;
shop.post("/orders", orderLimit, async (req, res) => {
  const b = checkoutSchema.parse(req.body);
  const c = await customer(req);
  const result = await serial(async (tx) => {
    const existing = await tx.shopOrder.findUnique({
      where: { requestKey: b.requestKey },
      include: { items: true },
    });
    if (existing) {
      if (existing.trackingHash !== hashToken(b.trackingToken))
        fail(409, "This checkout has already been submitted");
      if (
        existing.name !== b.name ||
        existing.phone !== b.phone ||
        existing.address !== b.address ||
        existing.zone !== b.cart.zone ||
        existing.items.length !== b.cart.items.length ||
        !existing.items.every((i) =>
          b.cart.items.some(
            (line) =>
              line.productId === i.productId &&
              line.quantity === i.quantity &&
              optionKey(line.selectedOptions) === optionKey(i.selectedOptions),
          ),
        )
      )
        fail(
          409,
          "This checkout was already submitted with different details. Track the previous order before starting a new checkout.",
        );
      return tx.shopOrder.findUniqueOrThrow({
        where: { id: existing.id },
        select: receipt,
      });
    }
    const q = await quote(tx, b.cart);
    if (!new Decimal(q.total).eq(b.expectedTotal))
      fail(
        409,
        "Prices or delivery charge changed. Review your cart and try again.",
      );
    for (const line of q.lines) {
      const changed = await tx.product.updateMany({
        where: {
          id: line.productId,
          ...visible,
          stock: { gte: line.quantity },
        },
        data: {
          stock: { decrement: line.quantity },
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        fail(409, "Stock changed. Please review your cart.");
    }
    const order = await tx.shopOrder.create({
      data: {
        orderNumber: `CJ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        requestKey: b.requestKey,
        trackingHash: hashToken(b.trackingToken),
        customerId: c?.id,
        name: b.name,
        phone: b.phone,
        email: b.email,
        address: b.address,
        district: b.district,
        zone: b.cart.zone,
        notes: b.notes,
        subtotal: q.subtotal,
        delivery: q.delivery,
        total: q.total,
        items: { create: q.lines },
      },
      select: receipt,
    });
    await tx.auditLog.create({
      data: { action: "shop.order.placed", entityId: order.id },
    });
    return order;
  });
  res.status(201).json(result);
});
shop.post("/track", orderLimit, async (req, res) => {
  const b = z
    .object({
      orderNumber: z.string().min(1).max(50),
      trackingToken: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
    .parse(req.body);
  const order = await db.shopOrder.findFirst({
    where: {
      orderNumber: b.orderNumber,
      trackingHash: hashToken(b.trackingToken),
    },
    select: receipt,
  });
  if (!order)
    fail(404, "Order not found. Check the order number and tracking key.");
  res.json(order);
});
shop.get("/orders", async (req, res) => {
  const c = await customer(req);
  if (!c) fail(401, "Please sign in to view your orders");
  res.json(
    await db.shopOrder.findMany({
      where: { customerId: c.id },
      select: receipt,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
});

commerce.use(authenticate, csrf);
commerce.get(
  "/settings",
  requirePermission("products.manage"),
  async (_req, res) => {
    res.json(await settings());
  },
);
commerce.put(
  "/settings",
  requirePermission("products.manage"),
  async (req, res) => {
    const b = z
      .object({
        acceptingOrders: z.boolean(),
        phone: z
          .string()
          .trim()
          .regex(
            /^(?:\+?88)?01[3-9]\d{8}$|^$/,
            "Enter a valid Bangladesh mobile number",
          ),
        whatsapp: z.string().regex(/^\d{10,15}$|^$/),
        email: z.union([email, z.literal("")]),
        address: z.string().trim().max(500),
        dhakaDelivery: money.nullable(),
        outsideDelivery: money.nullable(),
        deliveryInfo: z.string().trim().max(2000),
        returnPolicy: z.string().trim().max(5000),
        privacyPolicy: z.string().trim().max(5000),
        announcement: z.string().trim().max(200),
      })
      .strict()
      .parse(req.body);
    if (
      b.acceptingOrders &&
      (!b.phone ||
        !b.address ||
        b.dhakaDelivery === null ||
        b.outsideDelivery === null ||
        !b.deliveryInfo ||
        !b.returnPolicy ||
        !b.privacyPolicy)
    )
      fail(
        400,
        "Add contact/address, both delivery charges, delivery information, return and privacy policies before accepting orders",
      );
    const result = await db.$transaction(async (tx) => {
      const s = await tx.storeSettings.upsert({
        where: { id: "main" },
        create: { id: "main", ...b },
        update: b,
      });
      await tx.auditLog.create({
        data: {
          userId: (req as AuthRequest).auth.user.id,
          action: "shop.settings.updated",
          entityId: "main",
        },
      });
      return s;
    });
    res.json(result);
  },
);
commerce.get(
  "/orders",
  requirePermission("orders.manage"),
  async (req, res) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        status: z
          .enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"])
          .optional(),
        search: z.string().max(100).default(""),
      })
      .parse(req.query);
    const where = {
      ...(q.status ? { status: q.status } : {}),
      OR: ["orderNumber", "phone", "name"].map((field) => ({
        [field]: { contains: q.search, mode: "insensitive" as const },
      })),
    };
    const [items, total] = await db.$transaction([
      db.shopOrder.findMany({
        where,
        select: {
          ...receipt,
          name: true,
          phone: true,
          email: true,
          address: true,
          district: true,
          zone: true,
          notes: true,
          version: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: (q.page - 1) * 20,
      }),
      db.shopOrder.count({ where }),
    ]);
    res.json({ items, total, pages: Math.ceil(total / 20) });
  },
);
commerce.patch(
  "/orders/:id",
  requirePermission("orders.manage"),
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const b = z
      .object({
        status: z.enum(["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(req.body);
    const allowed: Record<string, string[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    await serial(async (tx) => {
      const old = await tx.shopOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!old) fail(404, "Order not found");
      if (old.version !== b.version)
        fail(409, "Order changed. Refresh before updating.");
      if (!allowed[old.status]!.includes(b.status))
        fail(400, "This order status change is not allowed");
      await tx.shopOrder.update({
        where: { id, version: b.version },
        data: { status: b.status, version: { increment: 1 } },
      });
      if (b.status === "CANCELLED")
        for (const item of old.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              version: { increment: 1 },
            },
          });
          await tx.stockAdjustment.create({
            data: {
              productId: item.productId,
              userId: (req as AuthRequest).auth.user.id,
              change: item.quantity,
              reason: `Cancelled order ${old.orderNumber}`,
            },
          });
        }
      await tx.auditLog.create({
        data: {
          userId: (req as AuthRequest).auth.user.id,
          action: `shop.order.${b.status.toLowerCase()}`,
          entityId: id,
        },
      });
    });
    res.json({ ok: true });
  },
);
