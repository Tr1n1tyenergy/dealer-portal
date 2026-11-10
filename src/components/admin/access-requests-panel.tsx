"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_MODULES, type PermissionKey } from "@/lib/permissions";
import { PermissionsDialog } from "./permissions-dialog";
import "./access-requests-panel.css";

type Request = {
  id: string;
  note: string | null;
  createdAt: string;
  modules: string[];
  requester: { id: string; firstName: string; lastName: string; role: string; permissions: string; department: string };
};
const label = (k: string) => PERMISSION_MODULES.find((m) => m.key === k)?.label ?? k;

/** Pending "Ask an Admin" requests. Grant opens the Permissions window with the asked-for areas ticked. */
export function AccessRequestsPanel({ requests }: { requests: Request[] }) {
  const router = useRouter();
  const [granting, setGranting] = useState<Request | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function decide(id: string, status: "GRANTED" | "DECLINED") {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/access-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return setError("Couldn't update the request. Please try again.");
    router.refresh();
  }

  if (requests.length === 0) return null;
  return (
    <section className="ui-panel arp" aria-labelledby="arp-title">
      <h2 id="arp-title" className="ui-section-title">
        Access requests
      </h2>
      <p className="arp-sub">Staff asking for more of the portal, oldest first.</p>
      <ul>
        {requests.map((r) => (
          <li key={r.id}>
            <span className="arp-who">
              <b>
                {r.requester.firstName} {r.requester.lastName}
              </b>
              <em>
                {r.requester.department} · asked {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" })}
              </em>
              <span>{r.modules.map(label).join(", ")}</span>
              {r.note ? <q>{r.note}</q> : null}
            </span>
            <span className="arp-btns">
              <button type="button" className="ui-btn ui-btn--primary" disabled={busy === r.id} onClick={() => setGranting(r)}>
                Grant
              </button>
              <button type="button" className="ui-btn ui-btn--secondary" disabled={busy === r.id} onClick={() => void decide(r.id, "DECLINED")}>
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="arp-error" role="alert">
          {error}
        </p>
      ) : null}
      {granting ? (
        <PermissionsDialog
          person={granting.requester}
          preTick={granting.modules.map((m) => `${m}.view` as PermissionKey)}
          onClose={() => setGranting(null)}
          onSaved={() => {
            const id = granting.id;
            setGranting(null);
            void decide(id, "GRANTED");
          }}
        />
      ) : null}
    </section>
  );
}
