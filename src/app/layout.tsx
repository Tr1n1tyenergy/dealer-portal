import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { A11Y_HEAD_SCRIPT } from "@/lib/a11y/preferences";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trinity Retail Intelligence",
  description: "Enterprise retail intelligence platform for Trinity Energy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies saved accessibility choices before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_HEAD_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/assets2/img/favicons/favicon.png" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
