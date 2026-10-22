"use client";

import { useEffect, useRef, useState } from "react";
import { roleLabel } from "@/lib/access";
import {
  canUser,
  parseOverrides,
  PERMISSION_MODULES,
  roleGrants,
  type PermissionKey,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";

type Person = { id: string; firstName: string; lastName: string; role: string; permissions: string };
type Tick = "allow" | "deny" | undefined;

/** Windows-style permissions for one staff member: Allow / Deny per module and level. */
export function PermissionsDialog({ person, onClose, onSaved }: { person: Person; onClose: () => void; onSaved: () => void }) {
  const original = parseOverrides(person.permissions);
  const [ticks, setTicks] = useState<Partial<Record<PermissionKey, "allow" | "deny">>>(original);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const firstBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstBox.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(key: PermissionKey, value: "allow" | "deny") {
    setTicks((t) => {
      const next = { ...t };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  const pending = { accountType: "INTERNAL", role: person.role, permissions: JSON.stringify(ticks) };

  async function save() {
    setSaving(true);
    setError("");
    const keys = new Set([...Object.keys(original), ...Object.keys(ticks)]) as Set<PermissionKey>;
    const changes = [...keys]
      .filter((key) => original[key] !== ticks[key])
      .map((key) => ({ key, value: ticks[key] ?? "inherit" }));
    const res = await fetch(`/api/users/${person.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save permissions.");
      return;
    }
    onSaved();
  }

  const box = (key: PermissionKey, value: "allow" | "deny", tick: Tick, first = false) => {
    const inherited = value === "allow" && !tick && roleGrants(person.role, key);
    return (
      <input
        ref={first ? firstBox : undefined}
        type="checkbox"
        aria-label={`${value === "allow" ? "Allow" : "Deny"} ${key}`}
        checked={tick === value || inherited}
        onChange={() => toggle(key, value)}
        className={inherited ? "opacity-50" : undefined}
        title={inherited ? "From the role (click to set it for this person)" : undefined}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="perm-title" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="perm-title" className="text-lg font-bold text-trinity-navy">
          Permissions for {person.firstName} {person.lastName} ({roleLabel(person.role)})
        </h2>
        <p className="mt-1 text-sm text-slate-500">Greyed ticks come from the role. Deny always wins; Act needs View.</p>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2">Module</th>
              <th className="py-2 text-center" colSpan={2}>View<br /><span className="normal-case">Allow · Deny</span></th>
              <th className="py-2 text-center" colSpan={2}>Act<br /><span className="normal-case">Allow · Deny</span></th>
              <th className="py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((m, index) => {
              const view = `${m.key}.view` as PermissionKey;
              const act = `${m.key}.act` as PermissionKey;
              const hasAct = m.levels.includes("act");
              const result = canUser(pending, m.key, "act") ? "Can view and act" : canUser(pending, m.key, "view") ? "Can view" : "No access";
              return (
                <tr key={m.key} className="border-t border-black/5">
                  <td className="py-2 font-semibold text-trinity-navy">{m.label}</td>
                  <td className="py-2 text-center">{box(view, "allow", ticks[view], index === 0)}</td>
                  <td className="py-2 text-center">{box(view, "deny", ticks[view])}</td>
                  <td className="py-2 text-center">{hasAct ? box(act, "allow", ticks[act]) : "—"}</td>
                  <td className="py-2 text-center">{hasAct ? box(act, "deny", ticks[act]) : null}</td>
                  <td className="py-2 text-slate-600">{result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
