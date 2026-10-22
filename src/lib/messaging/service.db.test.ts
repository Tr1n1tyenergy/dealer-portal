import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "messaging: dealers talk to Trinity staff, staff to staff, never dealer to dealer",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    const run = `m${Date.now()}`;
    const users: Record<"dealerA" | "dealerB" | "spe" | "admin" | "staff", string> = {
      dealerA: "",
      dealerB: "",
      spe: "",
      admin: "",
      staff: "",
    };
    const orgIds: string[] = [];
    let dealerChatId = "";

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      for (const key of ["dealerA", "dealerB"] as const) {
        const org = await prisma.dealerOrganization.create({ data: { name: `Test ${run} ${key}`, code: `T-${run}-${key}` } });
        orgIds.push(org.id);
        users[key] = (
          await prisma.user.create({
            data: {
              firstName: "T",
              lastName: key,
              email: `${key}.${run}@example.test`,
              department: "Dealer",
              accountType: "DEALER",
              role: "DEALER_ADMIN",
              status: "ACTIVE",
              dealerOrganizationId: org.id,
            },
          })
        ).id;
      }
      for (const [key, role] of [
        ["spe", "SALES_PERSON_EXECUTIVE"],
        ["admin", "SUPER_ADMIN"],
        ["staff", "STANDARD_USER"],
      ] as const) {
        users[key] = (
          await prisma.user.create({
            data: { firstName: "T", lastName: key, email: `${key}.${run}@example.test`, department: "T", role, status: "ACTIVE" },
          })
        ).id;
      }
      // A dealer-to-dealer chat made before the rule existed.
      const chat = await prisma.conversation.create({
        data: {
          directKey: [users.dealerA, users.dealerB].sort().join(":"),
          participants: { create: [{ userId: users.dealerA }, { userId: users.dealerB }] },
          messages: { create: [{ senderId: users.dealerB, body: "old dealer chat" }] },
        },
      });
      dealerChatId = chat.id;
    });

    after(async () => {
      const ids = Object.values(users).filter(Boolean);
      await prisma.conversation.deleteMany({ where: { participants: { some: { userId: { in: ids } } } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.dealerOrganization.deleteMany({ where: { id: { in: orgIds } } });
    });

    it("shows a dealer only Admins and Sales Person Executives to start a chat with", async () => {
      const ids = (await service.listDirectory(users.dealerA)).map((u) => u.id);
      assert.ok(ids.includes(users.spe));
      assert.ok(ids.includes(users.admin));
      assert.ok(!ids.includes(users.dealerB), "another dealer must not be listed");
      assert.ok(!ids.includes(users.staff), "a Staff Member must not be listed");
    });

    it("still shows staff the dealers and the other messaging staff", async () => {
      const ids = (await service.listDirectory(users.spe)).map((u) => u.id);
      assert.ok(ids.includes(users.dealerA));
      assert.ok(ids.includes(users.admin));
      assert.ok(!ids.includes(users.staff));
    });

    it("refuses a dealer starting a chat with another dealer", async () => {
      await assert.rejects(() => service.getOrCreateDirectConversation(users.dealerA, users.dealerB));
    });

    it("lets a dealer and a Sales Person Executive chat, and two staff chat", async () => {
      const withSpe = await service.getOrCreateDirectConversation(users.dealerA, users.spe);
      assert.equal(await service.assertParticipant(withSpe.id, users.dealerA), true);
      assert.equal(await service.assertParticipant(withSpe.id, users.spe), true);
      const staffChat = await service.getOrCreateDirectConversation(users.admin, users.spe);
      assert.equal(await service.assertParticipant(staffChat.id, users.admin), true);
      const listed = (await service.listConversationsForUser(users.dealerA)).map((c) => c.id);
      assert.ok(listed.includes(withSpe.id));
    });

    it("follows the person's ticks: an SPE denied Messaging leaves a dealer's contacts and chats", async () => {
      const chat = await service.getOrCreateDirectConversation(users.dealerA, users.spe);
      await prisma.user.update({ where: { id: users.spe }, data: { permissions: '{"messaging.view":"deny"}' } });
      try {
        const contacts = (await service.listDirectory(users.dealerA)).map((u) => u.id);
        assert.ok(!contacts.includes(users.spe), "denied SPE is not offered as a contact");
        const chats = (await service.listConversationsForUser(users.dealerA)).map((c) => c.id);
        assert.ok(!chats.includes(chat.id), "their chat is hidden");
        assert.equal(await service.assertParticipant(chat.id, users.dealerA), false);
      } finally {
        await prisma.user.update({ where: { id: users.spe }, data: { permissions: "[]" } });
      }
    });

    it("hides an old dealer-to-dealer chat and refuses reading or sending in it", async () => {
      const listed = (await service.listConversationsForUser(users.dealerA)).map((c) => c.id);
      assert.ok(!listed.includes(dealerChatId), "the old dealer chat must not be listed");
      assert.equal(await service.assertParticipant(dealerChatId, users.dealerA), false);
      await assert.rejects(() => service.listMessages(dealerChatId, users.dealerA), /Forbidden/);
      await assert.rejects(() => service.sendMessage(dealerChatId, users.dealerA, "hi"), /Forbidden/);
      await assert.rejects(() => service.getConversationContext(dealerChatId, users.dealerA), /Forbidden/);
      assert.equal(await prisma.message.count({ where: { conversationId: dealerChatId } }), 1, "nothing is deleted");
    });

    it("counts a dealer's unread messages from staff only, not from hidden dealer chats or themselves", async () => {
      const withSpe = await service.getOrCreateDirectConversation(users.dealerA, users.spe);
      const unreadFor = async (conversationId: string, senderId: string, readerId: string, body: string) =>
        prisma.message.create({
          data: { conversationId, senderId, body, receipts: { create: [{ userId: readerId, status: "SENT" }] } },
        });
      await unreadFor(withSpe.id, users.spe, users.dealerA, "PFI is ready");
      await unreadFor(withSpe.id, users.spe, users.dealerA, "Please pay today");
      // The dealer's own message: their receipt is READ, and it isn't theirs to read anyway.
      await prisma.message.create({
        data: {
          conversationId: withSpe.id,
          senderId: users.dealerA,
          body: "Thanks",
          receipts: { create: [{ userId: users.dealerA, status: "READ" }, { userId: users.spe, status: "SENT" }] },
        },
      });
      // An unread message in the hidden dealer-to-dealer chat.
      await unreadFor(dealerChatId, users.dealerB, users.dealerA, "psst");

      assert.equal(await service.unreadMessageCount(users.dealerA), 2);
    });
  },
);
