import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

// Dummy settings so getPusherServer() builds a client; its trigger is replaced below (no network).
const saved = { ...process.env };
Object.assign(process.env, { PUSHER_APP_ID: "1", PUSHER_KEY: "k", PUSHER_SECRET: "s", PUSHER_CLUSTER: "eu" });

describe("triggerConversationEvent", () => {
  after(() => {
    for (const key of ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("doesn't throw when Pusher fails — live updates are best-effort", async () => {
    const { getPusherServer, triggerConversationEvent } = await import("./server");
    const pusher = getPusherServer()!;
    pusher.trigger = (async () => {
      throw new Error("Pusher is down");
    }) as typeof pusher.trigger;

    await assert.doesNotReject(() => triggerConversationEvent("c1", "message:new", { id: "m1" }));
  });
});
