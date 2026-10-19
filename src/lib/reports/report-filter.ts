import type { Prisma } from "@prisma/client";
import { likeLiteral } from "@/lib/search";

export type ReportCategoryFilter = "FUEL_RETAIL" | "NON_FUEL_RETAIL" | "GENERAL";

/** Which reports a staff member's list shows: Admins see everyone's, others only their own. */
export function reportListWhere(input: {
  viewer: { id: string; role: string };
  category: string | null;
  q: string | null;
  from: string | null;
  to: string | null;
}): Prisma.ReportWhereInput {
  const { viewer, category, from, to } = input;
  const q = (input.q ?? "").trim().slice(0, 100);
  const term = likeLiteral(q);
  return {
    ...(viewer.role === "SUPER_ADMIN" ? {} : { userId: viewer.id }),
    ...(category && category !== "ALL" ? { category: category as ReportCategoryFilter } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
}
