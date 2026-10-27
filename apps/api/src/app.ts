import express, { type Request } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import pino from "pino";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { config, production } from "./config.js";
import {
  authenticate,
  csrf,
  originGuard,
  requirePermission,
  publicUser,
  newSession,
  passwordHash,
  hashToken,
  cookieName,
  cookieOptions,
  fail,
  HttpError,
  type AuthRequest,
} from "./security.js";
import {
  normalize,
  username,
  strongPassword,
  productSchema,
  calculationSchema,
  calculate,
  menus,
} from "./domain.js";
import { reportPdf } from "./pdf.js";
import { imageRouter } from "./images.js";
import { mountWeb } from "./web.js";
export const logger = pino({
  redact: [
    "req.headers.cookie",
    "req.headers.authorization",
    "req.headers.x-csrf-token",
    "res.headers.set-cookie",
  ],
  level: process.env.LOG_LEVEL ?? "info",
});
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", production ? 1 : false);
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    serializers: {
      req: (r) => ({ id: r.id, method: r.method, url: r.url?.split("?")[0] }),
      res: (r) => ({ statusCode: r.statusCode }),
    },
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Request-ID", String(req.id));
  res.setHeader("Cache-Control", "no-store");
  if (
    production &&
    !req.secure &&
    !["/api/health/live", "/api/health/ready"].includes(req.path)
  )
    return next(new HttpError(400, "HTTPS is required"));
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { imgSrc: ["'self'", "data:", "https://res.cloudinary.com"] },
    },
  }),
);
app.use(cors({ origin: config.APP_ORIGIN, credentials: true }));
app.use(express.json({ limit: "128kb" }));
app.use(cookieParser());
app.use(originGuard);
app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health/ready", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ error: { message: "Database unavailable" } });
  }
});
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: { message: "Too many sign-in attempts. Try again later." },
  },
});
const dummyHash = passwordHash("Dummy-only-value-8!DoNotUse");
const accountLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    hashToken(
      typeof req.body?.username === "string"
        ? normalize(req.body.username)
        : "invalid",
    ),
  message: {
    error: { message: "Too many sign-in attempts. Try again later." },
  },
});
app.post("/api/auth/login", loginLimit, accountLimit, async (req, res) => {
  const b = z
    .object({ username, password: z.string().min(1).max(128) })
    .strict()
    .parse(req.body);
  const user = await db.user.findUnique({
    where: { normalizedUsername: normalize(b.username) },
  });
  const valid = await argon2.verify(
    user?.passwordHash ?? (await dummyHash),
    b.password,
  );
  if (!valid || !user?.active) fail(401, "Invalid username or password");
  await newSession(user.id, res, user.passwordHash);
  res.json({ ok: true });
});
app.use("/api", authenticate, csrf);
app.get("/api/auth/me", (req, res) => {
  const a = (req as AuthRequest).auth;
  res.json({ ...publicUser(a.user, a.permissions), csrf: a.session.csrf });
});
app.post("/api/auth/logout", async (req, res) => {
  await db.session.deleteMany({
    where: { id: (req as AuthRequest).auth.session.id },
  });
  res.clearCookie(cookieName, cookieOptions).json({ ok: true });
});
app.post("/api/auth/password", async (req, res) => {
  const b = z
    .object({ currentPassword: z.string().max(128), password: strongPassword })
    .strict()
    .parse(req.body);
  const a = (req as AuthRequest).auth;
  if (!(await argon2.verify(a.user.passwordHash, b.currentPassword)))
    fail(400, "Current password is incorrect");
  if (b.password === b.currentPassword)
    fail(400, "Choose a different password");
  const hash = await passwordHash(b.password);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: a.user.id },
      data: { passwordHash: hash, mustChangePassword: false },
    });
    await tx.session.deleteMany({ where: { userId: a.user.id } });
    await tx.auditLog.create({
      data: {
        userId: a.user.id,
        action: "password.changed",
        entityId: a.user.id,
      },
    });
  });
  res.clearCookie(cookieName, cookieOptions).json({ ok: true });
});
const guard = requirePermission;
const actor = (req: Request) => (req as AuthRequest).auth.user.id;
const audit = (userId: string, action: string, entityId?: string) => ({
  userId,
  action,
  entityId,
});
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().max(100).default(""),
  categoryId: z.uuid().optional(),
  sort: z.enum(["name", "newest", "price"]).default("name"),
  archived: z.enum(["true", "false"]).default("false"),
});
const safeSelect = {
  id: true,
  productId: true,
  sku: true,
  name: true,
  category: true,
  description: true,
  minPrice: true,
  maxPrice: true,
  stock: true,
  lowStockThreshold: true,
  archived: true,
  version: true,
  images: true,
  updatedAt: true,
} as const;
async function catalog(req: Request, privileged = false) {
  const q = paging.parse(req.query);
  const where: Prisma.ProductWhereInput = {
    archived: privileged ? q.archived === "true" : false,
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    OR: ["name", "productId", "sku"].map((field) => ({
      [field]: { contains: q.search, mode: "insensitive" },
    })),
  };
  const [items, total] = await db.$transaction([
    db.product.findMany({
      where,
      select: { ...safeSelect, ...(privileged ? { buyingPrice: true } : {}) },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      orderBy:
        q.sort === "newest"
          ? { createdAt: "desc" }
          : q.sort === "price"
            ? { minPrice: "asc" }
            : { name: "asc" },
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page: q.page, pages: Math.ceil(total / q.limit) };
}
app.get("/api/dashboard", guard("dashboard.read"), async (req, res) =>
  res.json(await catalog(req)),
);
app.get("/api/categories", async (req, res) => {
  const p = (req as AuthRequest).auth.permissions;
  if (
    !(req as AuthRequest).auth.user.mustChangePassword &&
    p.some((p) =>
      ["dashboard.read", "products.read", "calculations.use"].includes(p),
    )
  )
    res.json(await db.category.findMany({ orderBy: { name: "asc" } }));
  else fail(403, "Access denied");
});
app.post("/api/categories", guard("products.manage"), async (req, res) => {
  const b = z
    .object({ name: z.string().trim().min(1).max(80) })
    .strict()
    .parse(req.body);
  const category = await db.$transaction(async (tx) => {
    const c = await tx.category.create({ data: b });
    await tx.auditLog.create({
      data: audit(actor(req), "category.created", c.id),
    });
    return c;
  });
  res.status(201).json(category);
});
app.patch("/api/categories/:id", guard("products.manage"), async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const b = z
    .object({ name: z.string().trim().min(1).max(80) })
    .strict()
    .parse(req.body);
  const c = await db.$transaction(async (tx) => {
    const c = await tx.category.update({ where: { id }, data: b });
    await tx.auditLog.create({
      data: audit(actor(req), "category.updated", id),
    });
    return c;
  });
  res.json(c);
});
app.delete(
  "/api/categories/:id",
  guard("products.manage"),
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    await db.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await tx.auditLog.create({
        data: audit(actor(req), "category.deleted", id),
      });
    });
    res.json({ ok: true });
  },
);
app.get("/api/products", guard("products.read"), async (req, res) =>
  res.json(await catalog(req, true)),
);
app.get(
  "/api/calculation-products",
  guard("calculations.use"),
  async (req, res) => res.json(await catalog(req, true)),
);
app.post("/api/products", guard("products.manage"), async (req, res) => {
  const { version: _version, ...b } = productSchema.parse(req.body);
  const product = await db.$transaction(async (tx) => {
    const p = await tx.product.create({ data: b });
    if (b.stock)
      await tx.stockAdjustment.create({
        data: {
          productId: p.id,
          userId: actor(req),
          change: b.stock,
          reason: "Opening stock",
        },
      });
    await tx.auditLog.create({
      data: audit(actor(req), "product.created", p.id),
    });
    return p;
  });
  res.status(201).json(product);
});
app.put("/api/products/:id", guard("products.manage"), async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { version, stock, ...b } = productSchema.parse(req.body);
  if (!version) fail(400, "Version is required");
  const p = await db.$transaction(async (tx) => {
    const old = await tx.product.findUnique({ where: { id } });
    if (!old) fail(404, "Product not found");
    if (old.stock !== stock)
      fail(400, "Use stock adjustment to change inventory");
    const updated = await tx.product.updateMany({
      where: { id, version },
      data: { ...b, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      fail(409, "This product changed. Reload it before editing");
    await tx.auditLog.create({
      data: audit(actor(req), "product.updated", id),
    });
    return tx.product.findUnique({ where: { id } });
  });
  res.json(p);
});
app.patch(
  "/api/products/:id/archive",
  guard("products.manage"),
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const b = z
      .object({ version: z.number().int().positive(), archived: z.boolean() })
      .strict()
      .parse(req.body);
    await db.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id, version: b.version },
        data: { archived: b.archived, version: { increment: 1 } },
      });
      if (!result.count) fail(409, "Product changed. Reload first");
      await tx.auditLog.create({
        data: audit(
          actor(req),
          b.archived ? "product.archived" : "product.restored",
          id,
        ),
      });
    });
    res.json({ ok: true });
  },
);
app.get("/api/products/:id/stock", guard("products.read"), async (req, res) =>
  res.json(
    await db.stockAdjustment.findMany({
      where: { productId: z.uuid().parse(req.params.id) },
      select: {
        id: true,
        change: true,
        reason: true,
        createdAt: true,
        user: { select: { username: true } },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
  ),
);
app.post(
  "/api/products/:id/stock",
  guard("products.manage"),
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const b = z
      .object({
        change: z
          .number()
          .int()
          .min(-100000000)
          .max(100000000)
          .refine((n) => n !== 0),
        reason: z.string().trim().min(1).max(300),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(req.body);
    await db.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: {
          id,
          version: b.version,
          stock: {
            gte: Math.max(0, -b.change),
            lte: 100000000 - Math.max(0, b.change),
          },
        },
        data: { stock: { increment: b.change }, version: { increment: 1 } },
      });
      if (!result.count)
        fail(409, "Stock changed or adjustment would exceed stock limits");
      await tx.stockAdjustment.create({
        data: {
          productId: id,
          userId: actor(req),
          change: b.change,
          reason: b.reason,
        },
      });
      await tx.auditLog.create({
        data: audit(actor(req), "stock.adjusted", id),
      });
    });
    res.json({ ok: true });
  },
);
app.use("/api/products", imageRouter);
async function compute(body: unknown) {
  const b = calculationSchema.parse(body);
  const products = await db.product.findMany({
    where: { id: { in: b.items.map((i) => i.productId) }, archived: false },
  });
  if (products.length !== b.items.length)
    fail(400, "One or more products are unavailable");
  return { b, result: calculate(b, products) };
}
app.post(
  "/api/calculations/preview",
  guard("calculations.use"),
  async (req, res) => res.json((await compute(req.body)).result),
);
app.post("/api/calculations", guard("calculations.use"), async (req, res) => {
  const { b, result } = await compute(req.body);
  if (b.sourceId) await ownedCalculation(req, b.sourceId);
  const c = await db.$transaction(async (tx) => {
    const c = await tx.calculation.create({
      data: {
        title: b.title,
        notes: b.notes,
        expenses: b.expenses,
        ownerId: actor(req),
        preparedBy: (req as AuthRequest).auth.user.username,
        sourceId: b.sourceId,
        reportNumber: "CJ-" + randomUUID().toUpperCase(),
        results: JSON.parse(JSON.stringify(result)),
        items: {
          create: result.lines.map((snapshot) => ({
            snapshot: JSON.parse(JSON.stringify(snapshot)),
          })),
        },
      },
    });
    await tx.auditLog.create({
      data: audit(actor(req), "calculation.saved", c.id),
    });
    return c;
  });
  res.status(201).json(c);
});
async function ownedCalculation(req: Request, id: string) {
  const c = await db.calculation.findFirst({
    where: {
      id: z.uuid().parse(id),
      ...((req as AuthRequest).auth.user.role === "ADMIN"
        ? {}
        : { ownerId: actor(req) }),
    },
    include: { items: true },
  });
  if (!c) fail(404, "Report not found");
  return c;
}
app.get("/api/calculations", guard("calculations.use"), async (req, res) => {
  const q = z
    .object({ page: z.coerce.number().int().min(1).default(1) })
    .parse(req.query);
  const where =
    (req as AuthRequest).auth.user.role === "ADMIN"
      ? {}
      : { ownerId: actor(req) };
  res.json(
    await db.calculation.findMany({
      where,
      take: 20,
      skip: (q.page - 1) * 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        reportNumber: true,
        createdAt: true,
        preparedBy: true,
        sourceId: true,
      },
    }),
  );
});
app.get("/api/calculations/:id", guard("calculations.use"), async (req, res) =>
  res.json(await ownedCalculation(req, String(req.params.id))),
);
app.get(
  "/api/calculations/:id/pdf",
  guard("reports.export"),
  async (req, res) => {
    const c = await ownedCalculation(req, String(req.params.id));
    const pdf = await reportPdf(c);
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${c.reportNumber}.pdf"`,
      })
      .send(pdf);
  },
);
app.get(
  "/api/admin/permissions",
  guard("permissions.manage"),
  async (_req, res) => res.json(await db.rolePermission.findMany()),
);
app.put(
  "/api/admin/permissions",
  guard("permissions.manage"),
  async (req, res) => {
    const b = z
      .object({
        role: z.enum(["MANAGER", "SHOPKEEPER"]),
        menu: z.enum(["Dashboard", "Manage Product", "Profit Calculation"]),
        enabled: z.boolean(),
      })
      .strict()
      .parse(req.body);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(924531)`;
      const permissions = [...menus[b.menu]];
      if (b.enabled)
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ role: b.role, permission })),
          skipDuplicates: true,
        });
      else
        await tx.rolePermission.deleteMany({
          where: { role: b.role, permission: { in: permissions } },
        });
      await tx.auditLog.create({
        data: audit(actor(req), `permissions.${b.role}.${b.menu}.${b.enabled}`),
      });
    });
    res.json({ ok: true });
  },
);
const userSelect = {
  id: true,
  username: true,
  role: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const;
app.get("/api/admin/users", guard("users.manage"), async (_req, res) =>
  res.json(
    await db.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ),
);
app.post("/api/admin/users", guard("users.manage"), async (req, res) => {
  const b = z
    .object({
      username,
      password: strongPassword,
      role: z.enum(["ADMIN", "MANAGER", "SHOPKEEPER"]),
    })
    .strict()
    .parse(req.body);
  const hash = await passwordHash(b.password);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        username: b.username,
        normalizedUsername: normalize(b.username),
        passwordHash: hash,
        role: b.role,
      },
      select: userSelect,
    });
    await tx.auditLog.create({ data: audit(actor(req), "user.created", u.id) });
    return u;
  });
  res.status(201).json(user);
});
app.patch("/api/admin/users/:id", guard("users.manage"), async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const b = z
    .object({
      role: z.enum(["ADMIN", "MANAGER", "SHOPKEEPER"]).optional(),
      active: z.boolean().optional(),
      password: strongPassword.optional(),
    })
    .strict()
    .parse(req.body);
  const hash = b.password ? await passwordHash(b.password) : undefined;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(924530)`;
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) fail(404, "User not found");
    if (
      user.role === "ADMIN" &&
      user.active &&
      (b.active === false || (b.role && b.role !== "ADMIN"))
    ) {
      if (
        (await tx.user.count({ where: { role: "ADMIN", active: true } })) <= 1
      )
        fail(409, "The last active administrator cannot be removed");
    }
    await tx.user.update({
      where: { id },
      data: {
        role: b.role,
        active: b.active,
        ...(hash ? { passwordHash: hash, mustChangePassword: true } : {}),
      },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({
      data: audit(actor(req), hash ? "user.access-reset" : "user.updated", id),
    });
  });
  res.json({ ok: true });
});
app.get("/api/admin/audit", guard("users.manage"), async (_req, res) =>
  res.json(
    await db.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true } } },
    }),
  ),
);
if (process.env.SERVE_WEB === "true") mountWeb(app);
app.use((_req, _res, next) => next(new HttpError(404, "Endpoint not found")));
app.use(
  (
    error: any,
    req: Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    let status = error instanceof HttpError ? error.status : 500;
    let message =
      error instanceof HttpError
        ? error.message
        : "An unexpected error occurred";
    if (error instanceof z.ZodError) {
      status = 400;
      message = error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    }
    if (error.code === "P2002") {
      status = 409;
      message = "That identifier already exists";
    }
    if (error.code === "P2003") {
      status = 409;
      message = "This record is in use or its category does not exist";
    }
    if (error.code === "P2025") {
      status = 404;
      message = "Record not found";
    }
    if (error.type === "entity.parse.failed") {
      status = 400;
      message = "Invalid JSON";
    }
    if (error.type === "entity.too.large" || error.code === "LIMIT_FILE_SIZE") {
      status = 413;
      message = "Request or image is too large";
    }
    if (
      typeof error.code === "string" &&
      error.code.startsWith("LIMIT_") &&
      error.code !== "LIMIT_FILE_SIZE"
    ) {
      status = 400;
      message = "Upload exactly one image and its product version";
    }
    if (status === 500)
      logger.error(
        { requestId: req.id, errorCode: error.code ?? error.name },
        "Request failed",
      );
    res.status(status).json({ error: { message, requestId: req.id } });
  },
);
