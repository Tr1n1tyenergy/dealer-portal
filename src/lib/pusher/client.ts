"use client";

import PusherClient from "pusher-js";

let client: PusherClient | null = null;

export function pusherClientConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY?.trim() &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim()
  );
}

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") return null;
  if (!pusherClientConfigured()) return null;
  if (!client) {
    client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/messaging/pusher/auth",
    });
  }
  return client;
}
