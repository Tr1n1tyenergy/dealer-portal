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
                  accountType: true,
                  dealerOrganization: {
                    select: {
                      name: true,
                      stations: { select: { tradingName: true, name: true }, take: 1 },
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
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
  });

  return rows.map((row) => {
    const others = row.conversation.participants.filter((p) => p.userId !== userId);
    const peer = others[0]?.user;
    const trading =
      peer?.dealerOrganization?.stations?.[0]?.tradingName ||
      peer?.dealerOrganization?.stations?.[0]?.name ||
      peer?.dealerOrganization?.name;
    const displayName = peer
      ? trading || `${peer.firstName} ${peer.lastName}`
      : "Conversation";
    const last = row.conversation.messages[0] ?? null;
    return {
      id: row.conversation.id,
      displayName,
      peer: peer
        ? {
            id: peer.id,
            firstName: peer.firstName,
            lastName: peer.lastName,
            accountType: peer.accountType,
          }
        : null,
      lastMessage: last
        ? { id: last.id, body: last.body, createdAt: last.createdAt, senderId: last.senderId }
        : null,
      lastMessageAt: row.conversation.lastMessageAt,
      lastReadAt: row.lastReadAt,
    };
  });
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
