import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: need a PostgreSQL database whose name ends in `_test` (see .env.test.local, `npm run test:db`).
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(process.env.DATABASE_URL ?? "");

describe("ticking action items done", { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" }, () => {
  let prisma: PrismaClient;
  let setActionDone: typeof import("./action-done").setActionDone;
  const run = `ad${Date.now()}`;
  const ids = { owner: "", other: "", session: "" };

  before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ setActionDone } = await import("./action-done"));
    for (const k of ["owner", "other"] as const) {
      ids[k] = (await prisma.user.create({ data: { firstName: "T", lastName: k, email: `${k}.${run}@example.test`, department: "T", status: "ACTIVE" } })).id;
    }
    ids.session = (await prisma.noteSession.create({ data: { name: "Depot planning", userId: ids.owner, notesJson: JSON.stringify({ actionItems: ["Send plan"] }) } })).id;
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.other] } } }); // cascades sessions and ticks
  });

  it("refuses ticking an item on someone else's session", async () => {
    const r = await setActionDone(ids.other, ids.session, "Send plan", true);
    assert.equal(r.ok ? null : r.status, 403);
  });

  it("ticking twice keeps one row; untick removes it", async () => {
    assert.ok((await setActionDone(ids.owner, ids.session, "Send plan", true)).ok);
    assert.ok((await setActionDone(ids.owner, ids.session, " send PLAN", true)).ok);
    assert.equal(await prisma.actionItemDone.count({ where: { userId: ids.owner } }), 1);
    assert.ok((await setActionDone(ids.owner, ids.session, "Send plan", false)).ok);
    assert.equal(await prisma.actionItemDone.count({ where: { userId: ids.owner } }), 0);
  });

  it("refuses a session that does not exist", async () => {
    const r = await setActionDone(ids.owner, "nope", "Send plan", true);
    assert.equal(r.ok ? null : r.status, 404);
  });
});
