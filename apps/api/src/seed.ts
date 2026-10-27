import { db } from "./db.js";
import { passwordHash } from "./security.js";
import { normalize, strongPassword, menus, username } from "./domain.js";
import { production, config } from "./config.js";
import { isLocalDemoDatabase } from "./postgres.js";
try {
  if (process.argv.includes("--bootstrap")) {
    const name = username.parse(process.env.BOOTSTRAP_USERNAME);
    const password = strongPassword.parse(process.env.BOOTSTRAP_PASSWORD);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(924530)`;
      if (await tx.user.count({ where: { role: "ADMIN" } }))
        throw new Error(
          "An administrator already exists; use account management",
        );
      await tx.user.create({
        data: {
          username: name,
          normalizedUsername: normalize(name),
          passwordHash: await passwordHash(password),
          role: "ADMIN",
          mustChangePassword: true,
        },
      });
      await tx.auditLog.create({ data: { action: "admin.bootstrapped" } });
      await tx.rolePermission.createMany({
        data: [
          ...Object.values(menus)
            .flat()
            .map((permission) => ({ role: "MANAGER" as const, permission })),
          { role: "SHOPKEEPER", permission: "dashboard.read" },
        ],
        skipDuplicates: true,
      });
    });
    console.log("Administrator created. Change the password at first sign-in.");
  } else {
    if (
      production ||
      process.env.ENABLE_DEMO_SEED !== "true" ||
      !isLocalDemoDatabase(config.DATABASE_URL)
    )
      throw new Error(
        "Demo seed requires a local loopback database, a non-production environment and ENABLE_DEMO_SEED=true",
      );
    for (const [name, role] of [
      ["admin", "ADMIN"],
      ["store manager", "MANAGER"],
      ["shopkeeper", "SHOPKEEPER"],
    ] as const) {
      await db.user.upsert({
        where: { normalizedUsername: normalize(name) },
        create: {
          username: name,
          normalizedUsername: normalize(name),
          passwordHash: await passwordHash(name),
          role,
          mustChangePassword: true,
        },
        update: {},
      });
    }
    for (const role of ["MANAGER", "SHOPKEEPER"] as const) {
      const existing = await db.rolePermission.count({ where: { role } });
      if (!existing)
        await db.rolePermission.createMany({
          data: (role === "MANAGER"
            ? Object.values(menus).flat()
            : ["dashboard.read"]
          ).map((permission) => ({ role, permission })),
          skipDuplicates: true,
        });
    }
    for (const name of [
      "Clothing",
      "Feeding",
      "Toys & play",
      "Bath & care",
      "Nursery",
    ])
      await db.category.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    console.log(
      "Development seed completed; existing passwords were preserved.",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Bootstrap failed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
