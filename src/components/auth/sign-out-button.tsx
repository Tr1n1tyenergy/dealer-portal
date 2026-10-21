"use client";

import { signOut } from "next-auth/react";

/** Signs the user out and returns them to the portal chooser, like the Dealer and Staff portals. */
export function SignOutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/access" })}>
      Sign out
    </button>
  );
}
