import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalApi, jsonError } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const isAdmin = auth.session.user.role === "SUPER_ADMIN";

  const presentation = await prisma.presentation.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: auth.session.user.id }),
    },
    include: { noteSession: true },
  });

  if (!presentation) return jsonError("Presentation not found", 404);
  return NextResponse.json({ presentation });
}
