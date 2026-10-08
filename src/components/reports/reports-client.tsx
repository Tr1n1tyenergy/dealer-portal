"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Report = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  createdAt: string;
};

export function ReportsClient({ initialReports }: { initialReports: Report[] }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (category !== "ALL" && r.category !== category) return false;
      if (q && !`${r.title} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [reports, category, q]);

  async function refresh() {
    const params = new URLSearchParams();
    if (category !== "ALL") params.set("category", category);
    if (q) params.set("q", q);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    const res = await fetch(`/api/reports?${params.toString()}`);
    const data = await res.json();
    setReports(data.reports ?? []);
  }

  async function createReport() {
    setLoading(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "Retail Performance Framework Report",
        category: category === "ALL" ? "GENERAL" : category,
        description: "Expandable retail reports framework for Fuel and Non-Fuel modules.",
        dateFrom: from ? new Date(from).toISOString() : undefined,
        dateTo: to ? new Date(to).toISOString() : undefined,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setTitle("");
      await refresh();
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters & Archive Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports" />
          </div>
          <div>
            <Label>Category</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="FUEL_RETAIL">Fuel Retail Reports</option>
              <option value="NON_FUEL_RETAIL">Non Fuel Retail Reports</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Button variant="outline" onClick={() => void refresh()}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Report (Framework)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Report title"
          />
          <Button onClick={() => void createReport()} disabled={loading}>
            {loading ? "Creating..." : "Create Report"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((report) => (
          <Link
            key={report.id}
            href={`/intelligence/reports/${report.id}`}
            className="card-premium block p-5 transition hover:-translate-y-0.5"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-trinity-gold">
              {report.category.replaceAll("_", " ")}
            </div>
            <h3 className="mt-2 text-lg font-bold text-trinity-navy">{report.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{report.description}</p>
          </Link>
        ))}
        {filtered.length === 0 ? (
          <div className="card-premium p-6 text-sm text-slate-500">No reports in archive yet.</div>
        ) : null}
      </div>
    </div>
  );
}
