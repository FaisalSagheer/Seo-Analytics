import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

function createClient() {
  const url = resolveDatabaseUrl();
  // The mariadb driver speaks MySQL; it expects the mariadb:// scheme.
  const adapter = new PrismaMariaDb(url.replace(/^mysql:\/\//, "mariadb://"));
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
