"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Keep session fetches relative to the tab origin so a local port mismatch
 * (e.g. NEXTAUTH_URL=:3000 while browsing :3001) cannot break /api/auth/session.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      basePath="/api/auth"
      refetchOnWindowFocus
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  );
}
