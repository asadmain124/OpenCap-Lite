// Prisma client extensions shared between the runtime client (src/lib/prisma.ts)
// and the seed scripts (prisma/seed*.ts).
//
// The SQLite schema (used by the Electron desktop build) declares Json columns
// as String because Prisma 5.x's SQLite connector does not support the Json
// scalar. The extension below transparently JSON-encodes on write and decodes
// on read so application code can keep passing/receiving objects.

import { Prisma } from "@prisma/client";

const JSON_FIELDS_BY_MODEL: Record<string, readonly string[]> = {
  Company: ["settings"],
  Scenario: ["snapshotJson"],
  ScenarioNewInstrumentInput: ["notesJson"],
  AuditLog: ["beforeJson", "afterJson"],
};

export function isSqliteUrl(url: string | undefined): boolean {
  return (url ?? "").startsWith("file:");
}

function encodeJsonInData(model: string | undefined, args: unknown): void {
  if (!model || !args || typeof args !== "object") return;
  const fields = JSON_FIELDS_BY_MODEL[model];
  if (!fields) return;
  const a = args as { data?: unknown };
  const data = a.data;
  if (!data || typeof data !== "object") return;
  const records = Array.isArray(data) ? data : [data];
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const r = record as Record<string, unknown>;
    for (const field of fields) {
      const v = r[field];
      if (v === undefined) continue;
      if (v === null) continue;
      if (typeof v === "string") continue;
      // Prisma's JsonNull / DbNull sentinels — convert to null for SQLite.
      if (v === Prisma.JsonNull || v === Prisma.DbNull) {
        r[field] = null;
        continue;
      }
      r[field] = JSON.stringify(v);
    }
  }
}

function decodeJsonInResult(model: string | undefined, result: unknown): void {
  if (!model || !result) return;
  const fields = JSON_FIELDS_BY_MODEL[model];
  if (!fields) return;
  const records = Array.isArray(result) ? result : [result];
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const r = record as Record<string, unknown>;
    for (const field of fields) {
      const v = r[field];
      if (typeof v !== "string") continue;
      try {
        r[field] = JSON.parse(v);
      } catch {
        // Stored a non-JSON string somehow — leave it.
      }
    }
  }
}

export const sqliteJsonExtension = Prisma.defineExtension({
  name: "sqlite-json",
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        encodeJsonInData(model, args);
        const result = await query(args);
        decodeJsonInResult(model, result);
        return result;
      },
    },
  },
});
