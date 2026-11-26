import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: need a PostgreSQL database whose name ends in `_test` (npm run test:db).
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "note actions and decks",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let createDeck: typeof import("./presentations").createDeck;
    let toggleNoteAction: typeof import("./note-sessions").toggleNoteAction;
    const run = `p${Date.now()}`;
    let userId = "";
    let otherId = "";

    const notes = JSON.stringify({
      meetingOverview: "o", attendees: ["Wanjiru Kamau"], discussionTopics: ["Prices"], keyDecisions: ["Use the list"],
      actionItems: ["Send sheet", "Confirm margin"], risks: ["Late trucks"], opportunities: [], followUpTasks: [], summary: "s",
    });
    const session = (owner: string, status: "COMPLETED" | "RECORDING" = "COMPLETED") =>
      prisma.noteSession.create({ data: { name: `Pricing ${run}`, userId: owner, status, notesJson: notes, notesStatus: "READY" } });

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      ({ createDeck } = await import("./presentations"));
      ({ toggleNoteAction } = await import("./note-sessions"));
      const mk = (n: string) =>
        prisma.user.create({ data: { firstName: "T", lastName: n, email: `${n}.${run}@example.test`, department: "T", accountType: "INTERNAL", status: "ACTIVE", passwordHash: "x" } });
      userId = (await mk("owner")).id;
      otherId = (await mk("other")).id;
    });

    after(async () => {
      await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    });

    it("ticking an action saves it in the notes, and ticking again clears it", async () => {
      const s = await session(userId);
      assert.deepEqual(await toggleNoteAction(s.id, userId, 1), [1]);
      assert.deepEqual(JSON.parse((await prisma.noteSession.findUniqueOrThrow({ where: { id: s.id } })).notesJson!).doneActions, [1]);
      assert.deepEqual(await toggleNoteAction(s.id, userId, 1), []);
    });

    it("an action that doesn't exist, or someone else's notes, change nothing", async () => {
      const s = await session(userId);
      assert.equal(await toggleNoteAction(s.id, userId, 2), null);
      assert.equal(await toggleNoteAction(s.id, otherId, 0), null);
    });

    it("a deck keeps the chosen sections, presenter and look", async () => {
      const s = await session(userId);
      const r = await createDeck({ userId, isAdmin: false, defaultPresenter: "T owner" }, { noteSessionId: s.id, presenter: "Wanjiru Kamau", sections: ["decisions", "risks"], theme: "blue" });
      assert.ok(r.presentation);
      assert.equal(r.presentation.theme, "blue");
      assert.equal(r.presentation.presenter, "Wanjiru Kamau");
      assert.deepEqual(JSON.parse(r.presentation.slidesJson).map((x: { id: string }) => x.id), ["title", "decisions", "risks"]);
    });

    it("a second deck from the same notes points at the first instead of failing", async () => {
      const s = await session(userId);
      const first = await createDeck({ userId, isAdmin: false, defaultPresenter: "T owner" }, { noteSessionId: s.id });
      assert.ok(first.presentation);
      assert.equal(first.presentation.theme, "light");
      assert.deepEqual(await createDeck({ userId, isAdmin: false, defaultPresenter: "T owner" }, { noteSessionId: s.id }), { existingId: first.presentation.id });
    });

    it("notes that are not finished, or belong to someone else, are not found", async () => {
      const live = await session(userId, "RECORDING");
      assert.deepEqual(await createDeck({ userId, isAdmin: false, defaultPresenter: "x" }, { noteSessionId: live.id }), { notFound: true });
      const theirs = await session(otherId);
      assert.deepEqual(await createDeck({ userId, isAdmin: false, defaultPresenter: "x" }, { noteSessionId: theirs.id }), { notFound: true });
    });
  },
);
