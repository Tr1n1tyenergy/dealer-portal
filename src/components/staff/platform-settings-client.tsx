"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { onGroupedInput, sanitizeNumericText } from "@/lib/forms/numeric-text";
import {
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Cylinder,
  Download,
  FileText,
  Fuel,
  Lock,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  dealerPriceFromParts,
  type StationPricingRow,
  type SettingsFuel,
} from "@/lib/settings/stations-pricing";
import type { OdooDriverRecord } from "@/lib/integrations/odoo/types";
import {
  createStationAction,
  deleteStationAction,
  updateStationPricingAction,
} from "@/lib/settings/station-actions";
import { TankManagementPanel } from "@/components/staff/tank-management-panel";
import { FleetTrucksPanel } from "@/components/staff/fleet-trucks-panel";
import { ActivityLogsPanel } from "@/components/staff/activity-logs-panel";
import type { ActivityFilterOptions, ActivityLogRow, ActivityStats } from "@/lib/settings/activity-log-types";

export type SettingsTab = "stations" | "tanks" | "trucks" | "activity" | "system";

type DealerOpt = { id: string; name: string };

type SystemEnv = {
  resendConfigured: boolean;
  storedSettings: Array<{ key: string; value: string }>;
};

type FuelDraft = {
  basePriceKes: string;
  dealerMarginKes: string;
  transportMarginKes: string;
};

type StationEditDraft = {
  name: string;
  fuels: Record<SettingsFuel, FuelDraft>;
};

type MenuPos = { top: number; left: number; openUp: boolean };

function money(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function numInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return sanitizeNumericText(String(n), true);
}

/** Settings dealer price = (base − dealer margin − transport margin) / 1.08, truncated to 6 dp. */
function dealerPriceFromDraft(draft: FuelDraft | undefined): number | null {
  if (!draft) return null;
  if (!draft.basePriceKes.trim() || !draft.dealerMarginKes.trim() || !draft.transportMarginKes.trim()) {
    return null;
  }
  const base = Number(draft.basePriceKes.replace(/,/g, ""));
  const margin = Number(draft.dealerMarginKes.replace(/,/g, ""));
  const transport = Number(draft.transportMarginKes.replace(/,/g, ""));
  return dealerPriceFromParts(base, margin, transport);
}

function emptyFuelDraft(): FuelDraft {
  return { basePriceKes: "", dealerMarginKes: "", transportMarginKes: "" };
}

function buildDraft(st: StationPricingRow): StationEditDraft {
  const fuels: StationEditDraft["fuels"] = {
    PMS: emptyFuelDraft(),
    AGO: emptyFuelDraft(),
  };
  for (const f of st.fuels) {
    fuels[f.fuel] = {
      basePriceKes: numInput(f.basePriceKes),
      dealerMarginKes: numInput(f.dealerMarginKes),
      transportMarginKes: numInput(f.transportMarginKes),
    };
  }
  // Ensure EPRA base is shown even if a fuel row was missing from products parse
  for (const key of ["PMS", "AGO"] as SettingsFuel[]) {
    if (!fuels[key].basePriceKes) {
      const fromRow = st.fuels.find((f) => f.fuel === key);
      if (fromRow?.epraBasePriceKes != null) {
        fuels[key].basePriceKes = numInput(fromRow.epraBasePriceKes);
      }
    }
  }
  return { name: st.name, fuels };
}

function draftsEqual(a: StationEditDraft, b: StationEditDraft): boolean {
  if (a.name !== b.name) return false;
  for (const fuel of ["PMS", "AGO"] as SettingsFuel[]) {
    const x = a.fuels[fuel];
    const y = b.fuels[fuel];
    if (
      x.basePriceKes !== y.basePriceKes ||
      x.dealerMarginKes !== y.dealerMarginKes ||
      x.transportMarginKes !== y.transportMarginKes
    ) {
      return false;
    }
  }
  return true;
}

function exportStationsCsv(rows: StationPricingRow[]) {
  const headers = [
    "Station",
    "Code",
    "Location",
    "Dealer",
    "Tanks",
    "Fuel",
    "Base Price (KES/L)",
    "Dealer Margin (KES/L)",
    "Transport Margin (KES/L)",
    "Dealer Price (KES/L ex-VAT)",
  ];
  const lines = [headers.join(",")];
  for (const st of rows) {
    for (const fuel of st.fuels) {
      const cells = [
        st.name,
        st.code ?? "",
        st.locationLabel,
        st.dealerName,
        String(st.tankCount),
        fuel.fuel,
        money(fuel.basePriceKes),
        money(fuel.dealerMarginKes),
        money(fuel.transportMarginKes),
        money(fuel.dealerPriceKes, 6),
      ].map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c));
      lines.push(cells.join(","));
    }
  }
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stations-pricing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const NAV: Array<{
  id: SettingsTab;
  title: string;
  desc: string;
  icon: typeof Fuel;
}> = [
  {
    id: "stations",
    title: "Stations & Pricing",
    desc: "Manage stations, dealers, prices and margins.",
    icon: Fuel,
  },
  {
    id: "tanks",
    title: "Tank Management",
    desc: "Create and manage fuel tanks per station.",
    icon: Cylinder,
  },
  {
    id: "trucks",
    title: "Fleet & Trucks",
    desc: "Driver and truck records from Odoo.",
    icon: Truck,
  },
  {
    id: "activity",
    title: "Activity Logs",
    desc: "View system activity by all users.",
    icon: FileText,
  },
];

export function PlatformSettingsClient({
  stations,
  dealers,
  drivers = [],
  driversError = null,
  canAct,
  canViewActivity,
  activityFilterOptions = null,
  activityInitial = null,
  system,
  initialTab = "stations",
}: {
  stations: StationPricingRow[];
  dealers: DealerOpt[];
  drivers?: OdooDriverRecord[];
  driversError?: string | null;
  canAct: boolean;
  canViewActivity: boolean;
  activityFilterOptions?: ActivityFilterOptions | null;
  activityInitial?: {
    rows: ActivityLogRow[];
    total: number;
    page: number;
    pageSize: number;
    stats: ActivityStats;
  } | null;
  system: SystemEnv;
  initialTab?: SettingsTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [q, setQ] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [stationId, setStationId] = useState("");
  const [fuel, setFuel] = useState<"ALL" | "PMS" | "AGO">("ALL");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(50);
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [activeStation, setActiveStation] = useState<StationPricingRow | null>(null);
  const [draft, setDraft] = useState<StationEditDraft | null>(null);
  const [baseline, setBaseline] = useState<StationEditDraft | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const menuPopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (modal !== "edit" && modal !== "delete" && modal !== "add") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  useLayoutEffect(() => {
    if (!menuId) {
      setMenuPos(null);
      return;
    }
    function place() {
      const btn = menuBtnRefs.current.get(menuId!);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = 200;
      const menuH = 108;
      const gap = 6;
      const openUp = r.bottom + gap + menuH > window.innerHeight - 8 && r.top > menuH + gap + 8;
      const top = openUp ? r.top - gap - menuH : r.bottom + gap;
      const left = Math.min(Math.max(8, r.right - menuW), window.innerWidth - menuW - 8);
      setMenuPos({ top, left, openUp });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const btn = menuBtnRefs.current.get(menuId!);
      if (menuPopRef.current?.contains(t) || btn?.contains(t)) return;
      setMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return stations.filter((st) => {
      if (dealerId && st.dealerOrganizationId !== dealerId) return false;
      if (stationId && st.id !== stationId) return false;
      if (fuel !== "ALL" && !st.fuels.some((f) => f.fuel === fuel)) return false;
      if (!query) return true;
      return (
        st.name.toLowerCase().includes(query) ||
        st.dealerName.toLowerCase().includes(query) ||
        (st.code ?? "").toLowerCase().includes(query) ||
        (st.tradingName ?? "").toLowerCase().includes(query)
      );
    });
  }, [stations, q, dealerId, stationId, fuel]);

  const pages = Math.max(1, Math.ceil(filtered.length / rows));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * rows, safePage * rows);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * rows + 1;
  const to = Math.min(safePage * rows, filtered.length);

  const dirty = draft != null && baseline != null && !draftsEqual(draft, baseline);

  useEffect(() => {
    if (modal !== "edit" && modal !== "delete" && modal !== "add") return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || pending) return;
      if (modal === "edit") {
        if (dirty && !window.confirm("Discard unsaved changes?")) return;
        setModal(null);
        setActiveStation(null);
        setDraft(null);
        setBaseline(null);
        setError(null);
        return;
      }
      if (modal === "delete") {
        setModal(null);
        setActiveStation(null);
        setError(null);
        return;
      }
      setModal(null);
      setError(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, pending, dirty]);

  function openAdd() {
    if (!canAct) return;
    setError(null);
    setMenuId(null);
    setActiveStation(null);
    setDraft(null);
    setBaseline(null);
    setModal("add");
  }

  function openEdit(st: StationPricingRow) {
    if (!canAct) return;
    setMenuId(null);
    setError(null);
    const next = buildDraft(st);
    setActiveStation(st);
    setDraft(next);
    setBaseline(next);
    setModal("edit");
  }

  function openDelete(st: StationPricingRow) {
    if (!canAct) return;
    setMenuId(null);
    setError(null);
    setActiveStation(st);
    setModal("delete");
  }

  function requestCloseEdit() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setModal(null);
    setActiveStation(null);
    setDraft(null);
    setBaseline(null);
    setError(null);
  }

  function closeDelete() {
    setModal(null);
    setActiveStation(null);
    setError(null);
  }

  function patchFuel(fuelKey: SettingsFuel, patch: Partial<FuelDraft>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fuels: {
          ...prev.fuels,
          [fuelKey]: { ...prev.fuels[fuelKey], ...patch },
        },
      };
    });
  }

  function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStation || !draft) return;
    setError(null);

    for (const fuelKey of ["PMS", "AGO"] as SettingsFuel[]) {
      const row = draft.fuels[fuelKey];
      if (!row.basePriceKes.trim()) {
        setError(`${fuelKey} base price is required.`);
        return;
      }
      if (!Number.isFinite(Number(row.basePriceKes.replace(/,/g, "")))) {
        setError(`${fuelKey} base price must be a number.`);
        return;
      }
      for (const [label, val] of [
        ["dealer margin", row.dealerMarginKes],
        ["transport margin", row.transportMarginKes],
      ] as const) {
        if (val.trim() && !Number.isFinite(Number(val.replace(/,/g, "")))) {
          setError(`${fuelKey} ${label} must be a number.`);
          return;
        }
      }
    }

    const fd = new FormData();
    fd.set("stationId", activeStation.id);
    fd.set("name", draft.name.trim());
    for (const fuelKey of ["PMS", "AGO"] as SettingsFuel[]) {
      const row = draft.fuels[fuelKey];
      fd.set(`base_${fuelKey}`, row.basePriceKes);
      fd.set(`dealerMargin_${fuelKey}`, row.dealerMarginKes);
      fd.set(`transportMargin_${fuelKey}`, row.transportMarginKes);
    }

    startTransition(async () => {
      const result = await updateStationPricingAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const savedName = draft.name.trim();
      setModal(null);
      setActiveStation(null);
      setDraft(null);
      setBaseline(null);
      setToast(`Station updated successfully. ${savedName}'s details and fuel pricing have been saved.`);
      router.refresh();
    });
  }

  function onConfirmDelete() {
    if (!activeStation) return;
    setError(null);
    const fd = new FormData();
    fd.set("stationId", activeStation.id);
    const name = activeStation.name;
    startTransition(async () => {
      const result = await deleteStationAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setActiveStation(null);
      setToast(`Station deleted successfully. ${name} has been removed.`);
      router.refresh();
    });
  }

  function onSubmitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await createStationAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setToast("Station created successfully.");
      router.refresh();
    });
  }

  const menuStation = menuId ? stations.find((s) => s.id === menuId) : null;

  return (
    <div className="ps-workspace">
      <nav className="ps-nav" aria-label="Settings modules">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`ps-nav__item${tab === item.id ? " is-active" : ""}`}
              onClick={() => {
                if (item.id === tab) return;
                setTab(item.id);
                router.push(`/intelligence/retail/settings?tab=${item.id}`);
              }}
            >
              <span className="ps-nav__ico" aria-hidden>
                <Icon size={22} strokeWidth={2.05} />
              </span>
              <span className="ps-nav__copy">
                <span className="ps-nav__title">{item.title}</span>
                <span className="ps-nav__desc">{item.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="ps-panel" aria-label="Settings module">
        {tab === "stations" ? (
          <>
            <div className="ps-panel__head">
              <span className="ps-panel__ico" aria-hidden>
                <Fuel size={22} strokeWidth={2.05} />
              </span>
              <div className="ps-panel__copy">
                <h2>Stations & Pricing</h2>
                <p>
                  View and manage station–dealer assignments, fuel prices, dealer margins, and transport
                  margins.
                </p>
              </div>
              {canAct ? (
                <button type="button" className="ps-btn ps-btn--gold" onClick={openAdd}>
                  <Plus size={16} strokeWidth={2.4} /> Add Station
                </button>
              ) : null}
            </div>

            <div className="ps-toolbar">
              <label className="ps-search">
                <Search className="ps-search__ico" size={14} aria-hidden />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search stations or dealers..."
                  aria-label="Search stations or dealers"
                />
              </label>
              <select
                className="ps-select"
                value={dealerId}
                onChange={(e) => {
                  setDealerId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by dealer"
              >
                <option value="">All Dealers</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                className="ps-select"
                value={stationId}
                onChange={(e) => {
                  setStationId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by station"
              >
                <option value="">All Stations</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="ps-select"
                value={fuel}
                onChange={(e) => {
                  setFuel(e.target.value as "ALL" | "PMS" | "AGO");
                  setPage(1);
                }}
                aria-label="Filter by fuel"
              >
                <option value="ALL">All Fuels</option>
                <option value="PMS">PMS</option>
                <option value="AGO">AGO</option>
              </select>
              <button type="button" className="ps-btn ps-btn--line" onClick={() => exportStationsCsv(filtered)}>
                <Download size={14} /> Export
              </button>
            </div>

            {slice.length === 0 ? (
              <div className="ps-empty">
                <strong>{stations.length === 0 ? "No stations yet" : "No stations match your filters"}</strong>
                <p>
                  {stations.length === 0
                    ? "Create a station to begin managing pricing and tank setup."
                    : "Try adjusting search or clearing filters."}
                </p>
                {stations.length > 0 ? (
                  <button
                    type="button"
                    className="ps-btn ps-btn--line"
                    onClick={() => {
                      setQ("");
                      setDealerId("");
                      setStationId("");
                      setFuel("ALL");
                      setPage(1);
                    }}
                  >
                    Clear Filters
                  </button>
                ) : canAct ? (
                  <button type="button" className="ps-btn ps-btn--gold" onClick={openAdd}>
                    <Plus size={16} /> Add Station
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <colgroup>
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "5.25rem" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th>Dealer (Organisation)</th>
                      <th>Fuel</th>
                      <th>
                        <span className="ps-th-stack">
                          <span className="ps-th-stack__title">Base Price</span>
                          <span>(KES/L)</span>
                        </span>
                      </th>
                      <th>
                        <span className="ps-th-stack">
                          <span className="ps-th-stack__title">Dealer Margin</span>
                          <span>(KES/L)</span>
                        </span>
                      </th>
                      <th>
                        <span className="ps-th-stack">
                          <span className="ps-th-stack__title">Transport Margin</span>
                          <span>(KES/L)</span>
                        </span>
                      </th>
                      <th>
                        <span className="ps-th-stack">
                          <span className="ps-th-stack__title">Dealer Prices</span>
                          <span>(KES/L ex-VAT)</span>
                        </span>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((st) => {
                      const fuels =
                        fuel === "ALL" ? st.fuels : st.fuels.filter((f) => f.fuel === fuel);
                      const first = fuels[0];
                      const rest = fuels.slice(1);
                      const rowSpan = Math.max(1, 1 + rest.length);
                      return (
                        <StationBlock
                          key={st.id}
                          station={st}
                          first={first}
                          rest={rest}
                          rowSpan={rowSpan}
                          canAct={canAct}
                          menuOpen={menuId === st.id}
                          menuBtnRef={(el) => {
                            if (el) menuBtnRefs.current.set(st.id, el);
                            else menuBtnRefs.current.delete(st.id);
                          }}
                          onToggleMenu={() => setMenuId(menuId === st.id ? null : st.id)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ps-pager">
              <span className="ps-pager__info">
                Showing {from} – {to} of {filtered.length} stations
              </span>
              <label>
                Rows per page:{" "}
                <select
                  value={rows}
                  onChange={(e) => {
                    setRows(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[6, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`ps-page${safePage <= 1 ? " is-disabled" : ""}`}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
                .map((n, i, list) => (
                  <span key={n} style={{ display: "inline-flex", gap: 6 }}>
                    {i > 0 && list[i - 1] !== n - 1 ? <span className="ps-page is-disabled">…</span> : null}
                    <button
                      type="button"
                      className="ps-page"
                      aria-current={n === safePage ? "page" : undefined}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                className={`ps-page${safePage >= pages ? " is-disabled" : ""}`}
                disabled={safePage >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </>
        ) : null}

        {tab === "tanks" ? (
          <TankManagementPanel stations={stations} canAct={canAct} initialStationId={stationId || undefined} />
        ) : null}

        {tab === "trucks" ? (
          <FleetTrucksPanel drivers={drivers} loadError={driversError} />
        ) : null}

        {tab === "activity" ? (
          <ActivityLogsPanel
            canView={canViewActivity}
            filterOptions={activityFilterOptions}
            initial={activityInitial}
          />
        ) : null}

        {tab === "system" ? (
          <div className="ps-system">
            <div className="ps-system__card">
              <h3>Environment</h3>
              <div className="ps-system__row">
                <strong>Auth</strong>
                <span>NextAuth credentials</span>
              </div>
              <div className="ps-system__row">
                <strong>Email</strong>
                <span>
                  Resend ({system.resendConfigured ? "configured" : "not configured — invites and resets can't be sent"})
                </span>
              </div>
              <div className="ps-system__row">
                <strong>Storage</strong>
                <span>AWS S3 hooks prepared</span>
              </div>
              <div className="ps-system__row">
                <strong>AI</strong>
                <span>Whisper / OpenAI pipeline placeholders ready</span>
              </div>
            </div>
            <div className="ps-system__card">
              <h3>Stored Settings</h3>
              {system.storedSettings.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ps-muted)" }}>
                  No custom settings yet. Seed defaults via admin tools as needed.
                </p>
              ) : (
                system.storedSettings.map((s) => (
                  <div className="ps-system__row" key={s.key}>
                    <strong>{s.key}</strong>
                    <span>{s.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      {mounted && menuId && menuPos && menuStation && canAct
        ? createPortal(
            <div
              ref={menuPopRef}
              className={`sp-actions-menu${menuPos.openUp ? " is-up" : ""}`}
              style={{ top: menuPos.top, left: menuPos.left } satisfies CSSProperties}
              role="menu"
              aria-label={`${menuStation.name} actions`}
            >
              <button
                type="button"
                role="menuitem"
                className="sp-actions-menu__item"
                onClick={() => openEdit(menuStation)}
              >
                <Pencil size={15} strokeWidth={2.1} aria-hidden />
                <span>Edit Station</span>
              </button>
              <div className="sp-actions-menu__divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="sp-actions-menu__item is-danger"
                onClick={() => openDelete(menuStation)}
              >
                <Trash2 size={15} strokeWidth={2.1} aria-hidden />
                <span>Delete Station</span>
              </button>
            </div>,
            document.body
          )
        : null}

      {toast ? (
        <div className="tm-toast" role="status">
          {toast}
          <button type="button" className="sp-toast__close" aria-label="Dismiss" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {modal === "add" ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="ps-station-modal-title">
          <div className="ps-modal__card tm-modal__card">
            <div className="tm-modal__head">
              <span className="ps-panel__ico sp-modal-ico" aria-hidden>
                <Plus size={18} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="ps-station-modal-title">Add Station</h3>
                <p>Create a station record linked to a dealer organisation.</p>
              </div>
              <button type="button" className="tm-modal__close" aria-label="Close" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            {error ? <p className="ps-modal__err">{error}</p> : null}
            <form onSubmit={onSubmitAdd}>
              <label>
                Station name
                <input name="name" required minLength={2} maxLength={120} disabled={pending} />
              </label>
              <label>
                Station code (slug)
                <input name="code" maxLength={48} placeholder="e.g. greensted" disabled={pending} />
              </label>
              <label>
                Trading name (optional)
                <input name="tradingName" maxLength={160} disabled={pending} />
              </label>
              <label>
                Dealer organisation
                <select name="dealerOrganizationId" required defaultValue="" disabled={pending}>
                  <option value="">Select dealer…</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ps-modal__actions">
                <button type="button" className="ps-btn ps-btn--line" onClick={() => setModal(null)} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className="ps-btn ps-btn--gold" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modal === "edit" && activeStation && draft ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="sp-edit-title">
          <div className="ps-modal__card tm-modal__card sp-edit-card">
            <div className="tm-modal__head">
              <span className="ps-panel__ico sp-modal-ico" aria-hidden>
                <Pencil size={18} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="sp-edit-title">Edit Station</h3>
                <p>Update station information and fuel pricing.</p>
                <span className="sp-edit-station-label">{activeStation.name}</span>
              </div>
              <button type="button" className="tm-modal__close" aria-label="Close" onClick={requestCloseEdit} disabled={pending}>
                <X size={18} />
              </button>
            </div>

            {error ? <p className="ps-modal__err">{error}</p> : null}

            <form onSubmit={onSaveEdit} className="sp-edit-form">
              <section className="sp-edit-section">
                <h4 className="sp-edit-section__title">Station Information</h4>
                <label className="sp-field">
                  <span className="sp-field__label">
                    Station Name <span className="sp-req">*</span>
                  </span>
                  <input
                    value={draft.name}
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={pending}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  />
                </label>
                <div className="sp-field">
                  <span className="sp-field__label">Dealer / Organisation</span>
                  <div className="sp-field__locked" title="Dealer assignment cannot be changed here">
                    <Lock size={14} aria-hidden />
                    <span>{activeStation.dealerName}</span>
                  </div>
                </div>
              </section>

              <section className="sp-edit-section">
                <h4 className="sp-edit-section__title">Fuel Pricing</h4>
                <p className="sp-edit-section__sub">Update base prices and margins for each fuel type.</p>

                {(["PMS", "AGO"] as SettingsFuel[]).map((fuelKey) => {
                  const row = draft.fuels[fuelKey];
                  const calc = dealerPriceFromDraft(row);
                  return (
                    <div key={fuelKey} className={`sp-fuel-block sp-fuel-block--${fuelKey.toLowerCase()}`}>
                      <div className="sp-fuel-block__head">
                        <span className={`ps-fuel ps-fuel--${fuelKey.toLowerCase()}`}>{fuelKey}</span>
                        <strong>{fuelKey === "PMS" ? "Petrol" : "Diesel"}</strong>
                      </div>
                      <div className="sp-fuel-grid">
                        <label className="sp-field">
                          <span className="sp-field__label">
                            Base Price (KES/L) <span className="sp-req">*</span>
                          </span>
                          <input
                            inputMode="decimal"
                            value={row.basePriceKes}
                            required
                            disabled={pending}
                            onChange={onGroupedInput(true, (value) => patchFuel(fuelKey, { basePriceKes: value }))}
                          />
                        </label>
                        <label className="sp-field">
                          <span className="sp-field__label">Dealer Margin (KES/L)</span>
                          <input
                            inputMode="decimal"
                            value={row.dealerMarginKes}
                            placeholder="Not configured"
                            disabled={pending}
                            onChange={onGroupedInput(true, (value) => patchFuel(fuelKey, { dealerMarginKes: value }))}
                          />
                        </label>
                        <label className="sp-field">
                          <span className="sp-field__label">Transport Margin (KES/L)</span>
                          <input
                            inputMode="decimal"
                            value={row.transportMarginKes}
                            placeholder="Not configured"
                            disabled={pending}
                            onChange={onGroupedInput(true, (value) => patchFuel(fuelKey, { transportMarginKes: value }))}
                          />
                        </label>
                      </div>
                      <div className="sp-field">
                        <span className="sp-field__label">Calculated Dealer Price (KES/L, ex-VAT)</span>
                        <div
                          className="sp-calc"
                          title="(Base − dealer margin − transport margin) ÷ 1.08 — exclusive of 8% VAT"
                        >
                          <span className="sp-calc__value">{calc == null ? "—" : money(calc, 6)}</span>
                          <span className="sp-calc__note">Exclusive of 8% VAT</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

              <div className="ps-modal__actions sp-edit-actions">
                <button type="button" className="ps-btn ps-btn--line" onClick={requestCloseEdit} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className="ps-btn ps-btn--gold" disabled={pending}>
                  <Check size={15} strokeWidth={2.4} aria-hidden />
                  {pending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modal === "delete" && activeStation ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="sp-del-title">
          <div className="ps-modal__card tm-modal__card sp-delete-card">
            <div className="tm-modal__head">
              <span className="ps-panel__ico sp-modal-ico sp-modal-ico--danger" aria-hidden>
                <Trash2 size={18} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="sp-del-title">Delete Station?</h3>
                <p>
                  Are you sure you want to delete <strong>{activeStation.name}</strong>? This action may affect
                  associated tanks, orders, pricing records, and operational data.
                </p>
              </div>
              <button type="button" className="tm-modal__close" aria-label="Close" onClick={closeDelete} disabled={pending}>
                <X size={18} />
              </button>
            </div>
            {error ? <p className="ps-modal__err">{error}</p> : null}
            <div className="ps-modal__actions">
              <button type="button" className="ps-btn ps-btn--line" onClick={closeDelete} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="ps-btn ps-btn--danger" onClick={onConfirmDelete} disabled={pending}>
                <Trash2 size={14} aria-hidden />
                {pending ? "Deleting…" : "Delete Station"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FuelPriceCells({ fuel }: { fuel: StationPricingRow["fuels"][number] }) {
  return (
    <>
      <td>
        <span className={`ps-fuel ps-fuel--${fuel.fuel.toLowerCase()}`}>{fuel.fuel}</span>
      </td>
      <td className="ps-num">{money(fuel.basePriceKes)}</td>
      <td className={`ps-num${fuel.dealerMarginKes == null ? " ps-num--muted" : ""}`}>
        {money(fuel.dealerMarginKes)}
      </td>
      <td className={`ps-num${fuel.transportMarginKes == null ? " ps-num--muted" : ""}`}>
        {money(fuel.transportMarginKes)}
      </td>
      <td
        className={`ps-num${fuel.dealerPriceKes == null ? " ps-num--muted" : ""}`}
        title="(Base − dealer margin − transport margin) ÷ 1.08"
      >
        {money(fuel.dealerPriceKes, 6)}
      </td>
    </>
  );
}

function StationBlock({
  station: st,
  first,
  rest,
  rowSpan,
  canAct,
  menuOpen,
  menuBtnRef,
  onToggleMenu,
}: {
  station: StationPricingRow;
  first: StationPricingRow["fuels"][number] | undefined;
  rest: StationPricingRow["fuels"];
  rowSpan: number;
  canAct: boolean;
  menuOpen: boolean;
  menuBtnRef: (el: HTMLButtonElement | null) => void;
  onToggleMenu: () => void;
}) {
  return (
    <>
      <tr className={`ps-station-block${rest.length > 0 ? " has-fuel-split" : ""}`}>
        <td rowSpan={rowSpan}>
          <div className="ps-station">
            <span className="ps-station__ico" aria-hidden>
              <MapPin size={14} />
            </span>
            <div>
              <div className="ps-station__name">{st.name}</div>
              <div className="ps-station__loc">{st.locationLabel}</div>
            </div>
          </div>
        </td>
        <td rowSpan={rowSpan}>
          <span className="ps-dealer">
            <Briefcase size={13} aria-hidden />
            <span>{st.dealerName}</span>
          </span>
        </td>
        {first ? (
          <FuelPriceCells fuel={first} />
        ) : (
          <td colSpan={5} className="ps-num--muted">
            No fuel products configured
          </td>
        )}
        <td rowSpan={rowSpan}>
          <div className="ps-actions">
            {canAct ? (
              <button
                type="button"
                className="ps-icon-btn"
                ref={menuBtnRef}
                aria-label={`More actions for ${st.name}`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={onToggleMenu}
              >
                <MoreVertical size={14} />
              </button>
            ) : (
              <button type="button" className="ps-icon-btn" aria-label="More actions" disabled>
                <MoreVertical size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {rest.map((f) => (
        <tr key={`${st.id}-${f.fuel}`} className="ps-fuel-rows">
          <FuelPriceCells fuel={f} />
        </tr>
      ))}
    </>
  );
}
