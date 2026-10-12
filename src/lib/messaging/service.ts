import { prisma } from "@/lib/prisma";
import { canMessageUser } from "./authz";
import { directConversationKey } from "./direct-key";
import { triggerConversationEvent } from "@/lib/pusher/server";

export async function assertParticipant(conversationId: string, userId: string) {
  const row = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  return Boolean(row);
}

export async function listConversationsForUser(userId: string) {
  const rows = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true,
                  accountType: true,
                  lastLoginAt: true,
                  dealerOrganizationId: true,
                  dealerOrganization: {
                    select: {
                      id: true,
                      name: true,
                      stations: {
                        select: { id: true, tradingName: true, name: true, code: true },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
  });

  const conversationIds = rows.map((r) => r.conversation.id);
  // One query (was groupBy + findMany) — count unread receipts per conversation
  const unreadReceipts =
    conversationIds.length === 0
      ? []
      : await prisma.messageReceipt.findMany({
          where: {
            userId,
            status: { in: ["SENT", "DELIVERED"] },
            message: {
              conversationId: { in: conversationIds },
              senderId: { not: userId },
              deletedAt: null,
            },
          },
          select: { message: { select: { conversationId: true } } },
        });
  const unreadByConversation = new Map<string, number>();
  for (const r of unreadReceipts) {
    const cid = r.message.conversationId;
    unreadByConversation.set(cid, (unreadByConversation.get(cid) ?? 0) + 1);
  }

  return rows.map((row) => {
    const others = row.conversation.participants.filter((p) => p.userId !== userId);
    const peer = others[0]?.user;
    const station = peer?.dealerOrganization?.stations?.[0];
    const trading =
      station?.tradingName || station?.name || peer?.dealerOrganization?.name;
    const displayName = peer
      ? trading || `${peer.firstName} ${peer.lastName}`
      : "Conversation";
    const last = row.conversation.messages[0] ?? null;
    const stationLabel = station?.tradingName || station?.name || null;
    return {
      id: row.conversation.id,
      displayName,
      peer: peer
        ? {
            id: peer.id,
            firstName: peer.firstName,
            lastName: peer.lastName,
            email: peer.email,
            department: peer.department,
            accountType: peer.accountType,
            lastLoginAt: peer.lastLoginAt,
            dealerOrganizationId: peer.dealerOrganizationId,
            organizationName: peer.dealerOrganization?.name ?? null,
            stationLabel,
            stationCode: station?.code ?? null,
          }
        : null,
      lastMessage: last
        ? { id: last.id, body: last.body, createdAt: last.createdAt, senderId: last.senderId }
        : null,
      lastMessageAt: row.conversation.lastMessageAt,
      lastReadAt: row.lastReadAt,
      unreadCount: unreadByConversation.get(row.conversation.id) ?? 0,
    };
  });
}

/** Operational context for the selected conversation (peer profile, orders, docs). */
export async function getConversationContext(conversationId: string, viewerId: string) {
  const [viewer, conversation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { id: true, accountType: true, dealerOrganizationId: true },
    }),
    prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                accountType: true,
                lastLoginAt: true,
                dealerOrganizationId: true,
                dealerOrganization: {
                  select: {
                    id: true,
                    name: true,
                    stations: {
                      select: { id: true, tradingName: true, name: true, code: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!viewer || !conversation) throw new Error("Forbidden");
  if (!conversation.participants.some((p) => p.userId === viewerId)) {
    throw new Error("Forbidden");
  }

  const peerRow = conversation.participants.find((p) => p.userId !== viewerId);
  const peer = peerRow?.user ?? null;
  const station = peer?.dealerOrganization?.stations?.[0] ?? null;
  const displayName = peer
    ? station?.tradingName ||
      station?.name ||
      peer.dealerOrganization?.name ||
      `${peer.firstName} ${peer.lastName}`
    : "Conversation";

  const orgId = peer?.dealerOrganizationId ?? null;
  const canSeeOrders =
    Boolean(orgId) &&
    (viewer.accountType === "INTERNAL" ||
      (viewer.accountType === "DEALER" && viewer.dealerOrganizationId === orgId));

  const [recentOrders, documents, pfis] = canSeeOrders
    ? await Promise.all([
        prisma.dealerOrder.findMany({
          where: { dealerOrganizationId: orgId! },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            reference: true,
            status: true,
            createdAt: true,
            station: { select: { name: true, tradingName: true } },
          },
        }),
        prisma.orderDocument.findMany({
          where: { order: { dealerOrganizationId: orgId! } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            fileName: true,
            kind: true,
            storagePath: true,
            createdAt: true,
            order: { select: { id: true, reference: true } },
          },
        }),
        prisma.proFormaInvoice.findMany({
          where: {
            order: { dealerOrganizationId: orgId! },
            documentPath: { not: null },
          },
          orderBy: { issuedAt: "desc" },
          take: 8,
          select: {
            id: true,
            number: true,
            documentPath: true,
            issuedAt: true,
            order: { select: { id: true, reference: true } },
          },
        }),
      ])
    : [[], [], []] as [never[], never[], never[]];

  return {
    conversationId,
    displayName,
    peer: peer
      ? {
          id: peer.id,
          firstName: peer.firstName,
          lastName: peer.lastName,
          email: peer.email,
          department: peer.department,
          accountType: peer.accountType,
          lastLoginAt: peer.lastLoginAt,
          organizationName: peer.dealerOrganization?.name ?? null,
          stationLabel: station?.tradingName || station?.name || null,
          stationCode: station?.code ?? null,
          locationHint: station?.name || peer.dealerOrganization?.name || peer.department || null,
        }
      : null,
    recentOrders,
    files: [
      ...documents.map((d) => ({
        id: d.id,
        source: "order_document" as const,
        fileName: d.fileName,
        kind: d.kind,
        createdAt: d.createdAt,
        orderId: d.order.id,
        orderReference: d.order.reference,
        downloadPath: `/api/messaging/files/order-document/${d.id}`,
      })),
      ...pfis.map((p) => ({
        id: p.id,
        source: "pfi" as const,
        fileName: `${p.number}.pdf`,
        kind: "PFI",
        createdAt: p.issuedAt,
        orderId: p.order.id,
        orderReference: p.order.reference,
        downloadPath: `/api/messaging/files/pfi/${p.id}`,
      })),
    ]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 8),
  };
}

export async function getOrCreateDirectConversation(actorId: string, peerId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  const peer = await prisma.user.findUnique({ where: { id: peerId } });
  if (!actor || !peer) throw new Error("User not found");

  const gate = canMessageUser({
    actorAccountType: actor.accountType,
    targetAccountType: peer.accountType,
    targetStatus: peer.status,
    actorId,
    targetId: peerId,
  });
  if (!gate.ok) throw new Error(gate.reason);

  const key = directConversationKey(actorId, peerId);
  const existing = await prisma.conversation.findUnique({
    where: { directKey: key },
    include: { participants: true },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      kind: "DIRECT",
      directKey: key,
      participants: {
        create: [{ userId: actorId }, { userId: peerId }],
      },
    },
    include: { participants: true },
  });
}

export async function listMessages(conversationId: string, userId: string, take = 50, before?: string) {
  const ok = await assertParticipant(conversationId, userId);
  if (!ok) throw new Error("Forbidden");

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      receipts: true,
      sender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return messages.reverse();
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const ok = await assertParticipant(conversationId, senderId);
  if (!ok) throw new Error("Forbidden");
  const text = body.trim();
  if (!text) throw new Error("Message body required");

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
  });

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId,
        body: text,
        receipts: {
          create: participants.map((p) => ({
            userId: p.userId,
            status: p.userId === senderId ? "READ" : "SENT",
          })),
        },
      },
      include: {
        receipts: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: msg.createdAt },
    });
    return msg;
  });

  await triggerConversationEvent(conversationId, "message:new", {
    message: {
      id: message.id,
      conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
      receipts: message.receipts,
    },
  });

  return message;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const ok = await assertParticipant(conversationId, userId);
  if (!ok) throw new Error("Forbidden");

  const now = new Date();
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: now },
  });

  const unread = await prisma.messageReceipt.findMany({
    where: {
      userId,
      status: { in: ["SENT", "DELIVERED"] },
      message: { conversationId, senderId: { not: userId } },
    },
    select: { id: true, messageId: true },
  });

  if (unread.length) {
    await prisma.messageReceipt.updateMany({
      where: { id: { in: unread.map((r) => r.id) } },
      data: { status: "READ" },
    });
    await triggerConversationEvent(conversationId, "receipt:update", {
      userId,
      status: "READ",
      messageIds: unread.map((r) => r.messageId),
    });
  }
}

export async function listDirectory(actorId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) return [];

  if (actor.accountType === "INTERNAL") {
    return prisma.user.findMany({
      where: {
        id: { not: actorId },
        status: "ACTIVE",
        accountType: { in: ["INTERNAL", "DEALER"] },
      },
      orderBy: [{ accountType: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        accountType: true,
        email: true,
        dealerOrganization: {
          select: {
            name: true,
            stations: { select: { tradingName: true, name: true }, take: 1 },
          },
        },
      },
    });
  }

  if (actor.accountType === "DEALER") {
    return prisma.user.findMany({
      where: {
        id: { not: actorId },
        status: "ACTIVE",
        accountType: { in: ["INTERNAL", "DEALER"] },
      },
      orderBy: [{ accountType: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        accountType: true,
        email: true,
        dealerOrganization: {
          select: {
            name: true,
            stations: { select: { tradingName: true, name: true }, take: 1 },
          },
        },
      },
    });
  }

  return [];
}
