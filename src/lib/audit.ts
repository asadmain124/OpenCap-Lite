import { prisma } from "@/lib/prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";

interface AuditEntry {
  companyId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  actor?: string | null;
}

/**
 * Fire-and-forget audit log writer. Never throws to the caller — logs to
 * stderr on failure so the API response is never blocked by audit issues.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        beforeJson: entry.before ? (JSON.parse(JSON.stringify(entry.before, bigintReplacer)) as object) : undefined,
        afterJson: entry.after ? (JSON.parse(JSON.stringify(entry.after, bigintReplacer)) as object) : undefined,
        actor: entry.actor ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("AuditLog write failed:", err);
  }
}

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}
