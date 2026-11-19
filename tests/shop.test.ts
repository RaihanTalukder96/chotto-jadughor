import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomBytes, randomUUID } from "node:crypto";
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Customer shop, checkout and order lifecycle",
  () => {
    let db: any,
      app: any,
      admin: any,
      guest: any,
      customer: any,
      category: any,
      product: any,
      draft: any,
      previousSettings: any;
    const prefix = "shop-test-" + randomUUID();
    const origin = "http://localhost:5173";
    const send = (agent: any, path: string, body: any, method = "post") =>
      agent[method](path)
        .set("Origin", origin)
        .set("X-CSRF-Token", agent.csrf || "")
        .send(body);
    const cart = (quantity = 1) => ({
      zone: "DHAKA",
      items: [{ productId: product.id, quantity }],
    });
    const checkout = (quantity = 1) => ({
      name: "Test Parent",
      phone: "01712345678",
      email: "",
      address: "House 1, Road 2, Dhaka",
      district: "Dhaka",
      notes: "",
      cart: cart(quantity),
      expectedTotal: String(150 * quantity + 60),
      requestKey: randomUUID(),
      trackingToken: randomBytes(32).toString("hex"),
      acceptPolicies: true,
    });
    async function shopper() {
      const agent: any = request.agent(app);
      agent.csrf = (await agent.get("/api/shop/session")).body.csrf;
      return agent;
    }
    beforeAll(async () => {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      process.env.NODE_ENV = "test";
      process.env.APP_ORIGIN = origin;
      process.env.LOG_LEVEL = "silent";
      ({ db } = await import("../apps/api/src/db.js"));
      ({ app } = await import("../apps/api/src/app.js"));
      const { passwordHash } = await import("../apps/api/src/security.js");
      await db.user.create({
        data: {
          username: prefix,
          normalizedUsername: prefix,
          passwordHash: await passwordHash("Test-Admin-Password-42!"),
          role: "ADMIN",
          mustChangePassword: false,
        },
      });
      admin = request.agent(app);
      await send(admin, "/api/auth/login", {
        username: prefix,
        password: "Test-Admin-Password-42!",
      });
      admin.csrf = (await admin.get("/api/auth/me")).body.csrf;
      previousSettings = await db.storeSettings.findUnique({
        where: { id: "main" },
      });
      await db.storeSettings.upsert({
        where: { id: "main" },
        create: {
          id: "main",
          acceptingOrders: true,
          dhakaDelivery: "60",
          outsideDelivery: "120",
        },
        update: {
          acceptingOrders: true,
          dhakaDelivery: "60",
          outsideDelivery: "120",
        },
      });
      category = await db.category.create({ data: { name: prefix } });
      const data = {
        productId: prefix,
        sku: prefix,
        name: "Baby test essential",
        categoryId: category.id,
        buyingPrice: "50",
        minPrice: "100",
        maxPrice: "300",
        retailPrice: "200",
        salePrice: "150",
        stock: 10,
        published: true,
        brand: prefix,
      };
      product = await db.product.create({ data });
      draft = await db.product.create({
        data: {
          ...data,
          productId: prefix + "-draft",
          sku: prefix + "-draft",
          published: false,
        },
      });
      guest = await shopper();
      customer = await shopper();
    });
    afterAll(async () => {
      if (!db) return;
      const ids = (
        await db.shopOrder.findMany({
          where: { items: { some: { productId: product?.id } } },
          select: { id: true },
        })
      ).map((i: any) => i.id);
      await db.shopOrderItem.deleteMany({ where: { orderId: { in: ids } } });
      await db.shopOrder.deleteMany({ where: { id: { in: ids } } });
      const users = await db.user.findMany({
        where: { normalizedUsername: prefix },
        select: { id: true },
      });
      await db.stockAdjustment.deleteMany({
        where: { userId: { in: users.map((u: any) => u.id) } },
      });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: users.map((u: any) => u.id) } },
            { entityId: { in: ids } },
          ],
        },
      });
      await db.product.deleteMany({ where: { categoryId: category?.id } });
      await db.category.deleteMany({ where: { id: category?.id } });
      await db.user.deleteMany({ where: { normalizedUsername: prefix } });
      await db.customer.deleteMany({
        where: { email: prefix + "@example.com" },
      });
      if (previousSettings) {
        const { updatedAt: _updatedAt, id: _id, ...data } = previousSettings;
        await db.storeSettings.update({ where: { id: "main" }, data });
      } else await db.storeSettings.deleteMany({ where: { id: "main" } });
      await db.$disconnect();
    });
    it("keeps drafts and staff-only fields private and filters effective sale prices", async () => {
      const r = await guest.get(
        `/api/shop/products?categoryId=${category.id}&min=140&max=160&sort=price-asc`,
      );
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(1);
      expect(r.body.items[0].id).toBe(product.id);
      for (const key of [
        "buyingPrice",
        "minPrice",
        "maxPrice",
        "version",
        "adjustments",
      ])
        expect(r.body.items[0]).not.toHaveProperty(key);
      expect((await guest.get(`/api/shop/products/${draft.id}`)).status).toBe(
        404,
      );
      expect((await guest.get("/api/products")).status).toBe(401);
      expect((await guest.get("/api/commerce/orders")).status).toBe(401);
    });
    it("requires same-origin CSRF for public mutations and validates server totals", async () => {
      expect(
        (
          await request(app)
            .post("/api/shop/quote")
            .set("Origin", origin)
            .send(cart())
        ).status,
      ).toBe(403);
      expect(
        (
          await guest
            .post("/api/shop/quote")
            .set("Origin", "https://evil.example")
            .set("X-CSRF-Token", guest.csrf)
            .send(cart())
        ).status,
      ).toBe(403);
      expect((await send(guest, "/api/shop/quote", cart())).body.total).toBe(
        "210.00",
      );
      expect(
        (
          await send(guest, "/api/shop/orders", {
            ...checkout(),
            expectedTotal: "1",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await send(guest, "/api/shop/orders", {
            ...checkout(),
            acceptPolicies: false,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await send(guest, "/api/shop/quote", {
            zone: "DHAKA",
            items: [{ productId: draft.id, quantity: 1 }],
          })
        ).status,
      ).toBe(409);
    });
    it("creates one order on retries, protects tracking and restores cancelled stock once", async () => {
      const input = checkout(2);
      const created = await send(guest, "/api/shop/orders", input);
      expect(created.status).toBe(201);
      expect(created.body.total).toBe("360");
      const again = await send(guest, "/api/shop/orders", input);
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(created.body.id);
      expect(
        (await db.product.findUnique({ where: { id: product.id } })).stock,
      ).toBe(8);
      expect(
        (
          await send(guest, "/api/shop/track", {
            orderNumber: created.body.orderNumber,
            trackingToken: input.trackingToken,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await send(guest, "/api/shop/track", {
            orderNumber: created.body.orderNumber,
            trackingToken: "a".repeat(64),
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await send(guest, "/api/shop/orders", {
            ...input,
            trackingToken: "b".repeat(64),
          })
        ).status,
      ).toBe(409);
      const orders = await admin.get(
        "/api/commerce/orders?search=" + created.body.orderNumber,
      );
      expect(orders.body.items[0].phone).toBe("01712345678");
      expect(orders.body.items[0]).not.toHaveProperty("trackingHash");
      expect(
        (
          await send(
            admin,
            `/api/commerce/orders/${created.body.id}`,
            { status: "CANCELLED", version: 1 },
            "patch",
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await send(
            admin,
            `/api/commerce/orders/${created.body.id}`,
            { status: "CANCELLED", version: 1 },
            "patch",
          )
        ).status,
      ).toBe(409);
      expect(
        (await db.product.findUnique({ where: { id: product.id } })).stock,
      ).toBe(10);
    });
    it("preserves price snapshots and enforces the fulfilment sequence", async () => {
      const input = checkout();
      const created = await send(guest, "/api/shop/orders", input);
      expect(created.status).toBe(201);
      const url = `/api/commerce/orders/${created.body.id}`;
      expect(
        (await send(admin, url, { status: "DELIVERED", version: 1 }, "patch"))
          .status,
      ).toBe(400);
      expect(
        (await send(admin, url, { status: "CONFIRMED", version: 1 }, "patch"))
          .status,
      ).toBe(200);
      expect(
        (await send(admin, url, { status: "SHIPPED", version: 2 }, "patch"))
          .status,
      ).toBe(200);
      expect(
        (await send(admin, url, { status: "CANCELLED", version: 3 }, "patch"))
          .status,
      ).toBe(400);
      expect(
        (await send(admin, url, { status: "DELIVERED", version: 3 }, "patch"))
          .status,
      ).toBe(200);
      await db.product.update({
        where: { id: product.id },
        data: { salePrice: "175" },
      });
      const tracked = await send(guest, "/api/shop/track", {
        orderNumber: created.body.orderNumber,
        trackingToken: input.trackingToken,
      });
      expect(tracked.body.items[0].unitPrice).toBe("150");
      expect(tracked.body.status).toBe("DELIVERED");
      await db.product.update({
        where: { id: product.id },
        data: { salePrice: "150", stock: 10 },
      });
    });
    it("prevents two checkouts from buying the last unit", async () => {
      await db.product.update({
        where: { id: product.id },
        data: { stock: 1 },
      });
      const second = await shopper();
      const responses = await Promise.all([
        send(guest, "/api/shop/orders", checkout()),
        send(second, "/api/shop/orders", checkout()),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        (await db.product.findUnique({ where: { id: product.id } })).stock,
      ).toBe(0);
      await db.product.update({
        where: { id: product.id },
        data: { stock: 10 },
      });
    });
    it("separates customer accounts from staff and exposes only their own order history", async () => {
      const data = {
        name: "Test Parent",
        email: prefix + "@example.com",
        password: "Customer-Password-42!",
      };
      expect((await send(customer, "/api/shop/register", data)).status).toBe(
        201,
      );
      expect(
        (await customer.get("/api/shop/session")).body.customer.email,
      ).toBe(data.email);
      expect((await customer.get("/api/auth/me")).status).toBe(401);
      expect((await customer.get("/api/shop/orders")).body).toEqual([]);
      const created = await send(customer, "/api/shop/orders", checkout());
      expect(created.status).toBe(201);
      expect(
        (await customer.get("/api/shop/orders")).body.map((o: any) => o.id),
      ).toContain(created.body.id);
      expect((await guest.get("/api/shop/orders")).status).toBe(401);
      expect((await send(customer, "/api/shop/logout", {})).status).toBe(200);
      expect(
        (
          await send(customer, "/api/shop/login", {
            email: data.email,
            password: data.password,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await send(customer, "/api/shop/password", {
            currentPassword: data.password,
            password: "Updated-Customer-Password-43!",
          })
        ).status,
      ).toBe(200);
      expect((await customer.get("/api/shop/orders")).status).toBe(401);
    });
    it("validates product options and preserves different selections in one order", async () => {
      const original = await db.product.findUnique({
        where: { id: product.id },
      });
      const options = [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Red", "Blue"] },
      ];
      const data = {
        productId: original.productId,
        sku: original.sku,
        name: original.name,
        categoryId: category.id,
        buyingPrice: String(original.buyingPrice),
        minPrice: String(original.minPrice),
        maxPrice: String(original.maxPrice),
        retailPrice: String(original.retailPrice),
        salePrice: String(original.salePrice),
        stock: original.stock,
        lowStockThreshold: original.lowStockThreshold,
        published: true,
        options,
        version: original.version,
      };
      expect(
        (
          await send(
            admin,
            `/api/products/${product.id}`,
            { ...data, options: [{ name: "Size", values: ["M", "m"] }] },
            "put",
          )
        ).status,
      ).toBe(400);
      const saved = await send(
        admin,
        `/api/products/${product.id}`,
        data,
        "put",
      );
      expect(saved.status).toBe(200);
      const { options: _options, ...legacy } = data;
      expect(
        (
          await send(
            admin,
            `/api/products/${product.id}`,
            { ...legacy, version: saved.body.version },
            "put",
          )
        ).status,
      ).toBe(200);
      try {
        expect(
          (await guest.get(`/api/shop/products/${product.id}`)).body.options,
        ).toEqual(options);
        expect((await send(guest, "/api/shop/quote", cart())).status).toBe(400);
        const selected = { Size: "S", Color: "Red" };
        const item = {
          productId: product.id,
          quantity: 1,
          selectedOptions: selected,
        };
        const input = {
          zone: "DHAKA",
          items: [
            item,
            { ...item, selectedOptions: { Size: "M", Color: "Blue" } },
          ],
        };
        expect(
          (
            await send(guest, "/api/shop/quote", {
              zone: "DHAKA",
              items: [
                { ...item, selectedOptions: { Size: "XL", Color: "Red" } },
              ],
            })
          ).status,
        ).toBe(400);
        expect(
          (
            await send(guest, "/api/shop/quote", {
              zone: "DHAKA",
              items: [
                item,
                { ...item, selectedOptions: { Color: "Red", Size: "S" } },
              ],
            })
          ).status,
        ).toBe(400);
        expect(
          (await send(guest, "/api/shop/quote", input)).body.lines[0]
            .selectedOptions,
        ).toEqual(selected);
        const orderBody = { ...checkout(2), cart: input };
        const order = await send(guest, "/api/shop/orders", orderBody);
        expect(order.status).toBe(201);
        expect(order.body.items.map((i: any) => i.selectedOptions)).toEqual(
          expect.arrayContaining([selected, { Size: "M", Color: "Blue" }]),
        );
        expect((await send(guest, "/api/shop/orders", orderBody)).body.id).toBe(
          order.body.id,
        );
        expect(
          (
            await send(guest, "/api/shop/orders", {
              ...orderBody,
              cart: {
                ...input,
                items: [
                  item,
                  { ...item, selectedOptions: { Size: "M", Color: "Red" } },
                ],
              },
            })
          ).status,
        ).toBe(409);
        const adminOrder = await admin.get(
          `/api/commerce/orders?search=${order.body.orderNumber}`,
        );
        expect(adminOrder.body.items[0].items[0].selectedOptions).toEqual(
          selected,
        );
        await db.product.update({
          where: { id: product.id },
          data: { stock: 1 },
        });
        expect((await send(guest, "/api/shop/quote", input)).status).toBe(409);
        await db.product.update({
          where: { id: product.id },
          data: { options: [] },
        });
        expect(
          (
            await send(guest, "/api/shop/track", {
              orderNumber: order.body.orderNumber,
              trackingToken: orderBody.trackingToken,
            })
          ).body.items[0].selectedOptions,
        ).toEqual(selected);
      } finally {
        await db.product.update({
          where: { id: product.id },
          data: { stock: original.stock, options: [] },
        });
      }
    });
    it("orders galleries, changes cover, and queues only removed assets for cleanup", async () => {
      const before = await db.product.findUnique({ where: { id: product.id } });
      const images = await Promise.all(
        Array.from({ length: 4 }, (_, position) =>
          db.productImage.create({
            data: {
              productId: product.id,
              publicId: `${prefix}-${position}`,
              url: `https://res.cloudinary.com/test/image-${position}.webp`,
              thumbnail: `https://res.cloudinary.com/test/thumb-${position}.webp`,
              position,
            },
          }),
        ),
      );
      try {
        const read = await guest.get(`/api/shop/products/${product.id}`);
        expect(read.body.images.map((i: any) => i.url)).toEqual(
          images.map((i) => i.url),
        );
        const cover = await send(
          admin,
          `/api/products/${product.id}/images/${images[3].id}/cover`,
          { version: before.version },
          "patch",
        );
        expect(cover.status).toBe(200);
        expect(cover.body.images[0].id).toBe(images[3].id);
        expect(
          (
            await send(
              admin,
              `/api/products/${product.id}/images/${images[0].id}`,
              { version: before.version },
              "delete",
            )
          ).status,
        ).toBe(409);
        const removed = await send(
          admin,
          `/api/products/${product.id}/images/${images[0].id}`,
          { version: cover.body.version },
          "delete",
        );
        expect(removed.status).toBe(200);
        expect(removed.body.images.map((i: any) => i.position)).toEqual([
          0, 1, 2,
        ]);
        expect(
          await db.assetCleanup.findUnique({
            where: { publicId: images[0].publicId },
          }),
        ).not.toBeNull();
        expect(
          (
            await send(
              admin,
              `/api/products/${product.id}/images/${randomUUID()}`,
              { version: removed.body.version },
              "delete",
            )
          ).status,
        ).toBe(404);
      } finally {
        await db.productImage.deleteMany({ where: { productId: product.id } });
        await db.assetCleanup.deleteMany({
          where: { publicId: { in: images.map((i) => i.publicId) } },
        });
      }
    });
    it("lets the administrator grant and revoke the Customer Orders menu", async () => {
      const previous = await db.rolePermission.findUnique({
        where: {
          role_permission: { role: "SHOPKEEPER", permission: "orders.manage" },
        },
      });
      const { passwordHash } = await import("../apps/api/src/security.js");
      const name = prefix + "-orders-staff";
      const user = await db.user.create({
        data: {
          username: name,
          normalizedUsername: name,
          passwordHash: await passwordHash("Orders-Staff-Password-42!"),
          role: "SHOPKEEPER",
          mustChangePassword: false,
        },
      });
      const staff: any = request.agent(app);
      try {
        await send(staff, "/api/auth/login", {
          username: name,
          password: "Orders-Staff-Password-42!",
        });
        expect(
          (
            await send(
              admin,
              "/api/admin/permissions",
              { role: "SHOPKEEPER", menu: "Customer Orders", enabled: true },
              "put",
            )
          ).status,
        ).toBe(200);
        expect((await staff.get("/api/commerce/orders")).status).toBe(200);
        expect(
          (
            await send(
              admin,
              "/api/admin/permissions",
              { role: "SHOPKEEPER", menu: "Customer Orders", enabled: false },
              "put",
            )
          ).status,
        ).toBe(200);
        expect((await staff.get("/api/commerce/orders")).status).toBe(403);
      } finally {
        if (previous)
          await db.rolePermission.upsert({
            where: {
              role_permission: {
                role: "SHOPKEEPER",
                permission: "orders.manage",
              },
            },
            create: { role: "SHOPKEEPER", permission: "orders.manage" },
            update: {},
          });
        await db.user.delete({ where: { id: user.id } });
      }
    });
    it("won't enable orders without delivery/contact policies and honours the pause switch", async () => {
      expect(
        (
          await send(
            admin,
            "/api/commerce/settings",
            {
              acceptingOrders: true,
              phone: "",
              whatsapp: "",
              email: "",
              address: "",
              dhakaDelivery: null,
              outsideDelivery: null,
              deliveryInfo: "",
              returnPolicy: "",
              privacyPolicy: "",
              announcement: "Test",
            },
            "put",
          )
        ).status,
      ).toBe(400);
      await db.storeSettings.update({
        where: { id: "main" },
        data: { acceptingOrders: false },
      });
      expect((await send(guest, "/api/shop/quote", cart())).status).toBe(503);
    });
  },
);
