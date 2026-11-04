import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

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

describe("notifyOrderChanged", () => {
  const keys = ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "PUSHER_CLUSTER"];
  before(() => Object.assign(process.env, { PUSHER_APP_ID: "1", PUSHER_KEY: "k", PUSHER_SECRET: "s", PUSHER_CLUSTER: "eu" }));
  after(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("tells staff and that order's dealer, with the order id and status only", async () => {
    const { getPusherServer, notifyOrderChanged } = await import("./server");
    const pusher = getPusherServer()!;
    const calls: unknown[][] = [];
    pusher.trigger = (async (...args: unknown[]) => {
      calls.push(args);
      return {} as never;
    }) as typeof pusher.trigger;
    await notifyOrderChanged({ id: "o1", status: "PAYMENT_CONFIRMED", dealerOrganizationId: "org9", amountDue: "1.00" } as never);
    assert.deepEqual(calls, [[["private-orders-staff", "private-orders-dealer-org9"], "order-changed", { orderId: "o1", status: "PAYMENT_CONFIRMED" }]]);
  });

  it("doesn't throw when Pusher fails", async () => {
    const { getPusherServer, notifyOrderChanged } = await import("./server");
    const pusher = getPusherServer()!;
    pusher.trigger = (async () => {
      throw new Error("down");
    }) as typeof pusher.trigger;
    await assert.doesNotReject(() => notifyOrderChanged({ id: "o1", status: "LOADING", dealerOrganizationId: "org9" }));
  });
});
