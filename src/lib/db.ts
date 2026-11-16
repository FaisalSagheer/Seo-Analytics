import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseConfig } from "@/lib/database-url";

function createClient() {
  // The mariadb driver speaks MySQL, and takes options (TLS certificate, pool size) rather than only a URL
  const adapter = new PrismaMariaDb(resolveDatabaseConfig());
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
