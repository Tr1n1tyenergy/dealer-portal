import Link from "next/link";
import type { ReactNode } from "react";

/** A working page's head (spec §6): optional way back, title, one line, and the page's main action. */
export function PageHead({
  title,
  description,
  action,
  back,
  aside,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
  /** Shown beside the title, e.g. the order's status chip. */
  aside?: ReactNode;
}) {
  return (
    <header className="ui-page-head">
      <div className="ui-page-head__text">
        {back ? (
          <Link href={back.href} className="ui-navlink ui-page-head__back">
            ← {back.label}
          </Link>
        ) : null}
        <div className="ui-page-head__title">
          <h1>{title}</h1>
          {aside}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-page-head__action">{action}</div> : null}
    </header>
  );
}
