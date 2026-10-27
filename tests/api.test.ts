import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
const enabled = !!process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)("PostgreSQL API security and workflows", () => {
  let db: any, app: any, hash: any;
  let admin: any, manager: any, shop: any, other: any;
  let category: string, product: any, report: any;
  const prefix = "test-" + randomUUID();
  const origin = "http://localhost:5173";
  const send = (agent: any, path: string, body: any, method = "post") =>
    agent[method](path)
      .set("Origin", origin)
      .set("X-CSRF-Token", agent.csrf ?? "")
      .send(body);
  async function login(name: string, password = "Strong-Test-Password-42!") {
    const agent: any = request.agent(app);
    expect(
      (
        await send(agent, "/api/auth/login", {
          username: prefix + name,
          password,
        })
      ).status,
    ).toBe(200);
    const me = await agent.get("/api/auth/me");
    agent.csrf = me.body.csrf;
    return agent;
  }
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.NODE_ENV = "test";
    process.env.APP_ORIGIN = origin;
    process.env.LOG_LEVEL = "silent";
    ({ db } = await import("../apps/api/src/db.js"));
    ({ app } = await import("../apps/api/src/app.js"));
    ({ passwordHash: hash } = await import("../apps/api/src/security.js"));
    for (const [name, role] of [
      ["admin", "ADMIN"],
      ["manager", "MANAGER"],
      ["shop", "SHOPKEEPER"],
      ["other", "MANAGER"],
    ])
      await db.user.create({
        data: {
          username: prefix + name,
          normalizedUsername: prefix + name,
          passwordHash: await hash("Strong-Test-Password-42!"),
          role,
          mustChangePassword: false,
        },
      });
    await db.rolePermission.createMany({
      data: [
        { role: "MANAGER", permission: "products.read" },
        { role: "MANAGER", permission: "products.manage" },
        { role: "MANAGER", permission: "calculations.use" },
        { role: "MANAGER", permission: "reports.export" },
        { role: "SHOPKEEPER", permission: "dashboard.read" },
      ],
      skipDuplicates: true,
    });
    admin = await login("admin");
    manager = await login("manager");
    shop = await login("shop");
    other = await login("other");
    category = (await send(admin, "/api/categories", { name: prefix })).body.id;
  });
  afterAll(async () => {
    if (!db) return;
    const users = await db.user.findMany({
      where: { username: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = users.map((u: any) => u.id);
    const cs = await db.calculation.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    });
    await db.calculationItem.deleteMany({
      where: { calculationId: { in: cs.map((c: any) => c.id) } },
    });
    await db.calculation.deleteMany({ where: { ownerId: { in: ids } } });
    await db.stockAdjustment.deleteMany({ where: { userId: { in: ids } } });
    await db.product.deleteMany({ where: { categoryId: category } });
    await db.category.deleteMany({ where: { id: category } });
    await db.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it("uses generic failed login and case-insensitive usernames containing spaces", async () => {
    const bad = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: "unknown", password: "wrong" });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe("Invalid username or password");
    const valid = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({
        username: " " + (prefix + "admin").toUpperCase() + " ",
        password: "Strong-Test-Password-42!",
      });
    expect(valid.status).toBe(200);
    const raw = valid.headers["set-cookie"][0].split(";")[0].split("=")[1];
    expect(await db.session.count({ where: { tokenHash: raw } })).toBe(0);
    await db.user.create({
      data: {
        username: prefix + " space user",
        normalizedUsername: prefix + " space user",
        passwordHash: await hash("Strong-Test-Password-42!"),
        role: "SHOPKEEPER",
        mustChangePassword: false,
      },
    });
    const spaced = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({
        username: " " + (prefix + " SPACE USER") + " ",
        password: "Strong-Test-Password-42!",
      });
    expect(spaced.status).toBe(200);
  });
  it("rejects direct API access and CSRF mutations for unauthorized users", async () => {
    expect((await shop.get("/api/products")).status).toBe(403);
    expect((await shop.get("/api/admin/users")).status).toBe(403);
    expect((await manager.get("/api/admin/permissions")).status).toBe(403);
    expect(
      (
        await admin
          .post("/api/categories")
          .set("Origin", origin)
          .send({ name: "blocked" })
      ).status,
    ).toBe(403);
    expect(
      (
        await admin
          .post("/api/categories")
          .set("Origin", "https://evil.invalid")
          .set("X-CSRF-Token", admin.csrf)
          .send({ name: "blocked" })
      ).status,
    ).toBe(403);
  });
  it("validates products, uniqueness and optimistic edit conflicts", async () => {
    const data = {
      productId: prefix,
      sku: prefix,
      name: "শিশুর পোশাক",
      categoryId: category,
      description: "",
      buyingPrice: "100.10",
      minPrice: "150.30",
      maxPrice: "200.50",
      stock: 10,
      lowStockThreshold: 2,
    };
    expect(
      (await send(manager, "/api/products", { ...data, stock: -1 })).status,
    ).toBe(400);
    const created = await send(manager, "/api/products", data);
    expect(created.status).toBe(201);
    product = created.body;
    expect((await send(manager, "/api/products", data)).status).toBe(409);
    expect(
      (
        await send(
          manager,
          `/api/products/${product.id}`,
          { ...data, version: 1, name: "Changed" },
          "put",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await send(
          manager,
          `/api/products/${product.id}`,
          { ...data, version: 1 },
          "put",
        )
      ).status,
    ).toBe(409);
  });
  it("excludes confidential costs from dashboard responses", async () => {
    const result = await shop.get("/api/dashboard?search=" + prefix);
    expect(result.status).toBe(200);
    expect(result.body.items[0].buyingPrice).toBeUndefined();
    expect(JSON.stringify(result.body)).not.toContain("passwordHash");
  });
  it("recomputes authoritative values, enforces ownership, and preserves snapshots", async () => {
    const b = {
      title: prefix,
      expenses: "10.05",
      items: [{ productId: product.id, quantity: 3 }],
    };
    expect(
      (await send(manager, "/api/calculations", { ...b, total: "0" })).status,
    ).toBe(400);
    expect(
      (
        await send(manager, "/api/calculations", {
          ...b,
          items: [{ productId: product.id, quantity: 3, buyingPrice: "0" }],
        })
      ).status,
    ).toBe(400);
    const result = await send(manager, "/api/calculations", b);
    expect(result.status).toBe(201);
    report = result.body;
    expect(report.results.cost).toBe("300.30");
    expect(report.results.scenarios.min.net).toBe("140.55");
    expect((await other.get(`/api/calculations/${report.id}`)).status).toBe(
      404,
    );
    expect((await other.get(`/api/calculations/${report.id}/pdf`)).status).toBe(
      404,
    );
    expect(
      (await request(app).get(`/api/calculations/${report.id}/pdf`)).status,
    ).toBe(401);
    await db.product.update({
      where: { id: product.id },
      data: { buyingPrice: "999.99", archived: true },
    });
    const snapshot = await manager.get(`/api/calculations/${report.id}`);
    expect(snapshot.body.items[0].snapshot.buyingPrice).toBe("100.1");
    expect(snapshot.body.results.cost).toBe("300.30");
    expect(
      (await db.product.findUnique({ where: { id: product.id } })).stock,
    ).toBe(10);
  });
  it("applies permission changes immediately without login", async () => {
    expect((await shop.get("/api/products")).status).toBe(403);
    expect(
      (
        await send(
          admin,
          "/api/admin/permissions",
          { role: "SHOPKEEPER", menu: "Manage Product", enabled: true },
          "put",
        )
      ).status,
    ).toBe(200);
    expect((await shop.get("/api/products")).status).toBe(200);
    await send(
      admin,
      "/api/admin/permissions",
      { role: "SHOPKEEPER", menu: "Manage Product", enabled: false },
      "put",
    );
    expect((await shop.get("/api/products")).status).toBe(403);
  });
  it("requires initial password changes and revokes previous sessions on password change", async () => {
    const user = await db.user.findUnique({
      where: { normalizedUsername: prefix + "other" },
    });
    await db.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true },
    });
    expect((await other.get("/api/calculation-products")).status).toBe(403);
    expect(
      (
        await send(other, "/api/auth/password", {
          currentPassword: "Strong-Test-Password-42!",
          password: "Replacement-Password-54!",
        })
      ).status,
    ).toBe(200);
    expect((await other.get("/api/auth/me")).status).toBe(401);
  });
  it("expires sessions and revokes them on disable/reset", async () => {
    const agent = await login("manager");
    const user = await db.user.findUnique({
      where: { normalizedUsername: prefix + "manager" },
    });
    await db.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(0) },
    });
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    const fresh = await login("manager");
    expect(
      (
        await send(
          admin,
          `/api/admin/users/${user.id}`,
          { active: false },
          "patch",
        )
      ).status,
    ).toBe(200);
    expect((await fresh.get("/api/auth/me")).status).toBe(401);
    await send(admin, `/api/admin/users/${user.id}`, { active: true }, "patch");
    const resetAgent = await login("manager");
    await send(
      admin,
      `/api/admin/users/${user.id}`,
      { password: "Reset-Strong-Password-56!" },
      "patch",
    );
    expect((await resetAgent.get("/api/auth/me")).status).toBe(401);
  });
  it("protects the last active administrator (isolated test database)", async () => {
    const count = await db.user.count({
      where: { role: "ADMIN", active: true },
    });
    expect(count).toBe(1);
    const user = await db.user.findUnique({
      where: { normalizedUsername: prefix + "admin" },
    });
    expect(
      (
        await send(
          admin,
          `/api/admin/users/${user.id}`,
          { active: false },
          "patch",
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await send(
          admin,
          `/api/admin/users/${user.id}`,
          { role: "SHOPKEEPER" },
          "patch",
        )
      ).status,
    ).toBe(409);
  });
  it("rejects disguised SVG and validates image content", async () => {
    const { validateImage } = await import("../apps/api/src/images.js");
    await expect(
      validateImage(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      ),
    ).rejects.toThrow("Only JPEG");
    await expect(validateImage(Buffer.from("fake jpg"))).rejects.toThrow(
      "Only JPEG",
    );
    const sharp = (await import("sharp")).default;
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    expect((await sharp(await validateImage(png)).metadata()).format).toBe(
      "webp",
    );
    const oversized = await admin
      .post(`/api/products/${product.id}/image`)
      .set("Origin", origin)
      .set("X-CSRF-Token", admin.csrf)
      .field("version", "2")
      .attach("image", Buffer.alloc(6 * 1024 * 1024), {
        filename: "large.jpg",
        contentType: "image/jpeg",
      });
    expect(oversized.status).toBe(413);
  });
  it("refuses to issue a session if the password changed after login verification", async () => {
    const user = await db.user.findUnique({
      where: { normalizedUsername: prefix + "manager" },
    });
    const { newSession } = await import("../apps/api/src/security.js");
    await expect(
      newSession(user.id, {} as any, "stale-verified-password-hash"),
    ).rejects.toThrow("Invalid username or password");
  });
  it("throttles repeated failed login attempts", async () => {
    let response: any;
    for (let i = 0; i < 16; i++)
      response = await request(app)
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ username: prefix + "missing", password: "incorrect" });
    expect(response.status).toBe(429);
  });
});
