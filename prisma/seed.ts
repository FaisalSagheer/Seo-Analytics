/**
 * Creates (or resets) the demo account and its demo project.
 * Credentials come from DEMO_EMAIL / DEMO_PASSWORD (see .env.example).
 * With DEMO_MODE off it removes the demo account instead.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoProject } from "../src/lib/demo/seed-project";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaMariaDb(url.replace(/^mysql:\/\//, "mariadb://")) });

const email = process.env.DEMO_EMAIL ?? "demo@bisibility.local";
const password = process.env.DEMO_PASSWORD ?? "demo-password-123";

async function main() {
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
      accounts: {
        create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(password) },
      },
    },
  });
  const project = await seedDemoProject(db, userId);
  console.log(`Seeded demo user ${email} with project ${project.domain}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
