/**
 * Seeds two optional things (see .env.example):
 *  - the demo account and project, from DEMO_EMAIL / DEMO_PASSWORD. With DEMO_MODE
 *    off it removes the demo account instead.
 *  - the first admin, from SEED_ADMIN_EMAIL / SEED_PASSWORD. Created as Admin when
 *    missing; an existing account with that email is promoted to Admin and keeps its
 *    password.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoProject } from "../src/lib/demo/seed-project";
import { resolveDatabaseConfig } from "../src/lib/database-url";

const db = new PrismaClient({ adapter: new PrismaMariaDb(resolveDatabaseConfig()) });

const email = process.env.DEMO_EMAIL ?? "demo@seoengine.local";
const password = process.env.DEMO_PASSWORD ?? "demo-password-123";

async function seedDemo() {
  // The demo account used to be demo@bisibility.local; drop it so its public password doesn't outlive the rename
  await db.user.deleteMany({ where: { email: "demo@bisibility.local" } });
  const existing = await db.user.findUnique({ where: { email } });
  // Deleting the user cascades to its sessions and the projects it owns
  if (existing) await db.user.delete({ where: { id: existing.id } });

  // With demo mode off the account would only be a known password into the team
  if (!["true", "1"].includes(process.env.DEMO_MODE ?? "")) {
    console.log(existing ? `DEMO_MODE is off: removed demo user ${email}` : "DEMO_MODE is off: no demo user to remove");
    return;
  }

  const userId = randomUUID();
  await db.user.create({
    data: {
      id: userId,
      email,
      name: "Demo User",
      emailVerified: true,
      // Not the default role: the demo sign-in is public, so it must not see real projects
      roleId: "role_demo",
      accounts: {
        create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(password) },
      },
    },
  });
  const project = await seedDemoProject(db, userId);
  console.log(`Seeded demo user ${email} with project ${project.domain}`);
}

async function seedAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    console.log("SEED_ADMIN_EMAIL is not set: no admin account to seed");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error(`SEED_ADMIN_EMAIL "${adminEmail}" is not a valid email address.`);
  // The demo step deletes and recreates this address, so it can't also be the admin
  if (adminEmail === email.toLowerCase()) throw new Error("SEED_ADMIN_EMAIL can't be the same as DEMO_EMAIL.");

  const adminRole = await db.role.findFirst({ where: { isSystem: true } });
  if (!adminRole) throw new Error("The Admin role doesn't exist. Run `npm run db:deploy` first.");

  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { roleId: adminRole.id } });
    console.log(`${adminEmail} already exists: made Admin (password unchanged)`);
    return;
  }

  const adminPassword = process.env.SEED_PASSWORD ?? "";
  if (adminPassword.length < 8) throw new Error("SEED_PASSWORD must be at least 8 characters to create the admin account.");
  const userId = randomUUID();
  await db.user.create({
    data: {
      id: userId,
      email: adminEmail,
      name: "Admin",
      emailVerified: true,
      roleId: adminRole.id,
      accounts: {
        create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(adminPassword) },
      },
    },
  });
  console.log(`Created admin ${adminEmail}. Remove SEED_PASSWORD from .env now that it's set.`);
}

async function main() {
  await seedDemo();
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
