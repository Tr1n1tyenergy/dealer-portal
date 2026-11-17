import type { ActivityActionKind, ActivityModuleKey, ActivityOutcome } from "@/lib/settings/activity-present";
import { ACTIVITY_MODULES } from "@/lib/settings/activity-present";

export type ActivityDatePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export type ActivityQueryInput = {
  datePreset: ActivityDatePreset;
  dateFrom?: string | null;
  dateTo?: string | null;
  actorId?: string | null;
  module?: ActivityModuleKey | "ALL" | null;
  actionKind?: ActivityActionKind | "ALL" | null;
  stationId?: string | null;
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
};

export type ActivityLogRow = {
  id: string;
  createdAt: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  module: ActivityModuleKey;
  moduleLabel: string;
  actionKind: ActivityActionKind;
  outcome: ActivityOutcome;
  details: string;
  stationId: string | null;
  stationName: string | null;
  actorId: string | null;
  actorName: string;
  actorInitials: string;
  actorRole: string | null;
  actorEmail: string | null;
  meta: Record<string, unknown>;
};

export type ActivityStats = {
  total: number;
  successful: number;
  updates: number;
  deletions: number;
  access: number;
};

export type ActivityFilterOptions = {
  users: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
  modules: typeof ACTIVITY_MODULES;
};
