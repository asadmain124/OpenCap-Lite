import { prisma } from "@/lib/prisma";

/**
 * Server-side helper: return the ID of the first (primary) company. The
 * current UI is single-tenant; when multi-tenant mode arrives this becomes
 * a lookup keyed by the signed-in user.
 */
export async function getPrimaryCompanyId(): Promise<string | null> {
  const first = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}
