import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const COMPANY_COOKIE = "opencap.companyId";

/**
 * Server-side helper: return the active company ID. Honors the
 * `opencap.companyId` cookie set by the TopBar switcher; falls back
 * to the first company by creation date.
 */
export async function getPrimaryCompanyId(): Promise<string | null> {
  const cookieId = cookies().get(COMPANY_COOKIE)?.value;
  if (cookieId) {
    const exists = await prisma.company.findUnique({
      where: { id: cookieId },
      select: { id: true },
    });
    if (exists) return exists.id;
  }
  const first = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}
