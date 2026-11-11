import Link from "next/link";
import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { listTicketsForStaff } from "@/lib/support/service";
import "@/app/intelligence/retail/staff-home.css";

export default async function StaffSupportPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "support", "view")) redirect("/intelligence/retail");

  const tickets = await listTicketsForStaff({ department: "ALL", status: "ALL" });
  const open = tickets.filter((t) => t.status !== "CLOSED");

  return (
    <div className="sh" style={{ paddingTop: "1.5rem" }}>
      <div className="sh-wrap">
        <header className="sh-panel" style={{ marginBottom: "1rem" }}>
          <div className="sh-panel__head" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div>
              <h1 className="sh-panel__title">Support</h1>
              <p className="sh-panel__sub">
                Live dealer support tickets from the portal queue.
              </p>
            </div>
            <span className="sh-badge sh-badge--pending">{open.length} open</span>
          </div>
        </header>

        <article className="sh-panel">
          {tickets.length === 0 ? (
            <p className="sh-empty">No support tickets have been raised yet.</p>
          ) : (
            <ul className="sh-feed">
              {tickets.map((t) => (
                <li key={t.id}>
                  <div className="sh-feed__item" style={{ gridTemplateColumns: "1fr auto" }}>
                    <div>
                      <p className="sh-feed__text">
                        <strong>{t.reference}</strong> — {t.subject}
                      </p>
                      <p className="sh-kpi__meta" style={{ marginTop: 4 }}>
                        {t.dealerOrganization.name} · {t.status.replaceAll("_", " ")} ·{" "}
                        {t.priority}
                      </p>
                    </div>
                    <span className="sh-feed__time">
                      {t.updatedAt.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="sh-empty" style={{ marginTop: "1rem" }}>
            Dealer-facing ticket detail remains in the dealer Support Centre. Staff reply workflows
            continue via{" "}
            <Link href="/intelligence/retail/messaging" className="sh-panel__link">
              Messages
            </Link>
            .
          </p>
        </article>
      </div>
    </div>
  );
}
