"use client";

import { SignInSplash } from "@/components/ui/sign-in-splash";

/** Local preview of the welcome (jumping-man) splash — open /dev/welcome-splash (not behind auth). */
export default function WelcomeSplashPreviewPage() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        margin: 0,
        background: "#ffffff",
      }}
    >
      <SignInSplash preview />
    </main>
  );
}
