import { prisma } from "@/lib/prisma";

export async function logActivity(params: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metaJson: params.meta ? JSON.stringify(params.meta) : null,
      },
    });
  } catch {
    // Non-blocking for core flows
  }
}
