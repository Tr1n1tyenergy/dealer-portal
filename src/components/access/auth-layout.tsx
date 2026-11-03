import { TrinityLogo } from "@/components/brand/trinity-logo";
import { SUPPORT_EMAIL } from "@/lib/company/contact";
import "@/app/intelligence/login/login.css";

/**
 * Shared frame for sign-in, activation, password and error pages (redesign spec §6): the station photo
 * with a short headline on one side, the form on white on the other; on phones the photo is a strip on top.
 */
export function AuthLayout({
  kicker = "Trinity Energy",
  headline,
  copy,
  children,
}: {
  /** Short yellow word above the headline, like the station name on the E2 dashboard. */
  kicker?: string;
  headline: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth__photo">
        <div className="auth__photo-text">
          <span className="auth__kicker">{kicker}</span>
          <h1>{headline}</h1>
          <p>{copy}</p>
        </div>
      </aside>
      <main className="auth__panel">
        <div className="auth__card">
          <TrinityLogo variant="dark" height={40} />
          {children}
        </div>
        <footer className="auth__footer">
          © {new Date().getFullYear()} Trinity Energy Limited · Need help?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </footer>
      </main>
    </div>
  );
}
