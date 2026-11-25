import Link from "next/link";
import type { CSSProperties } from "react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MODULE_PANEL as PANEL, type TriModule } from "@/lib/modules";
import "./modules-home.css";

export function ModulesHome({
  greeting,
  line,
  name,
  role,
  work,
  admin,
  needYou,
}: {
  greeting: string;
  line: string;
  name: string;
  role: string;
  work: TriModule[];
  admin: TriModule[];
  needYou: number;
}) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "TE";

  return (
    <main className="mh">
      <header className="mh-top">
        <Link href="/intelligence/dashboard" className="mh-logo" aria-label="Trinity Retail Intelligence home">
          <TrinityLogo variant="dark" height={26} />
        </Link>
        <div className="mh-who">
          <div className="mh-who__text">
            <span>{name}</span>
            <small>{role}</small>
          </div>
          <span className="mh-avatar" aria-hidden>
            {initials}
          </span>
          <span className="mh-signout">
            <SignOutButton />
          </span>
        </div>
      </header>

      <section className="mh-hello">
        <p className="mh-eyebrow">Trinity Retail Intelligence</p>
        <h1>{greeting}.</h1>
        <p className="mh-line">{line}</p>

        {work.length + admin.length === 0 ? (
          <p className="mh-empty">No modules are available for your role yet. Ask an Admin if you need access.</p>
        ) : null}

        {work.length > 0 ? (
          <nav aria-label="Modules" className="mh-panels" style={{ "--mh-cols": work.length } as CSSProperties}>
            {work.map((mod) => {
              const Icon = mod.icon;
              const copy = PANEL[mod.id] ?? { title: mod.title, text: mod.description };
              return (
                <Link key={mod.id} href={mod.href} className="mh-panel">
                  <Icon aria-hidden size={22} strokeWidth={1.8} />
                  <h2>{copy.title}</h2>
                  <p>{copy.text}</p>
                  {mod.id === "reports" && needYou > 0 ? <span className="mh-tag">{needYou} need you</span> : null}
                  <span className="mh-open">
                    Open <span aria-hidden>→</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        ) : null}

        {admin.length > 0 ? (
          <nav aria-label="Admin" className="mh-admin">
            <span className="mh-admin__label">Admin</span>
            {admin.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link key={mod.id} href={mod.href}>
                  <Icon aria-hidden size={16} strokeWidth={1.8} />
                  {mod.title === "Activity Logs" ? "Activity logs" : mod.title}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
