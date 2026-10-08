"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type NoteSession = { id: string; name: string; status: string; createdAt: string };
type Presentation = {
  id: string;
  title: string;
  createdAt: string;
  noteSession?: { name: string } | null;
};

export function PresentationsClient({
  sessions,
  presentations,
}: {
  sessions: NoteSession[];
  presentations: Presentation[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [selected, setSelected] = useState(search.get("from") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createPresentation() {
    if (!selected) {
      setError("Select meeting notes first.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteSessionId: selected }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Unable to create presentation");
      return;
    }
    router.push(`/intelligence/presentations/${data.presentation.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Presentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Select completed Note Taker meeting notes to auto-generate an executive deck.
          </p>
          <select
            className="flex h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select Meeting Notes</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <Button onClick={() => void createPresentation()} disabled={loading}>
            {loading ? "Generating..." : "Create Presentation"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-black text-trinity-navy">Presentation Archive</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {presentations.map((p) => (
            <Link
              key={p.id}
              href={`/intelligence/presentations/${p.id}`}
              className="card-premium block p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-trinity-gold">
                Deck
              </div>
              <h3 className="mt-2 text-lg font-bold text-trinity-navy">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-500">
                Source: {p.noteSession?.name ?? "Meeting notes"}
              </p>
            </Link>
          ))}
          {presentations.length === 0 ? (
            <div className="card-premium p-6 text-sm text-slate-500">
              No presentations yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
