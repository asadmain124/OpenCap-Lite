import { PrismaClient } from "@prisma/client";

import { isSqliteUrl, sqliteJsonExtension } from "./prisma-extensions";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  if (!isSqliteUrl(process.env.DATABASE_URL)) return base;
  // The extension only adds query-layer transforms; it doesn't change the
  // surface API. Cast back to PrismaClient so callers stay on the stable
  // type (extended-client types don't unify cleanly with $transaction's
  // callback overload).
  return base.$extends(sqliteJsonExtension) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
