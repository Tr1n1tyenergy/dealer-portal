"use server";

import { exportActivityLogsCsv, queryActivityLogs } from "@/lib/settings/activity-logs";
import type { ActivityQueryInput } from "@/lib/settings/activity-log-types";

export async function queryActivityLogsAction(input: ActivityQueryInput) {
  try {
    const data = await queryActivityLogs(input);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to load activity logs." };
  }
}

export async function exportActivityLogsAction(input: ActivityQueryInput) {
  try {
    const csv = await exportActivityLogsCsv(input);
    return { ok: true as const, csv };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to export activity logs." };
  }
}
