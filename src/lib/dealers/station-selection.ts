/**
 * Rules for which stations one dealer invite may cover. Shared by the invite form and the
 * invite API so both show the same message. Client-safe: no database or catalog imports.
 */

export type StationSelectionRow = {
  stationCode: string;
  stationName: string;
  orgCode: string;
  orgName: string;
  invitable: boolean;
};

export type SelectionResult<T> =
  | { ok: true; orgCode: string; orgName: string; rows: T[] }
  | { ok: false; status: 400; message: string };

function refuse(message: string): { ok: false; status: 400; message: string } {
  return { ok: false, status: 400, message };
}

/** One invite = one dealer company: every station must exist, be invitable and share an orgCode. */
export function checkStationSelection<T extends StationSelectionRow>(
  rows: T[],
  codes: string[]
): SelectionResult<T> {
  const unique = Array.from(new Set(codes));
  if (unique.length === 0) return refuse("Select at least one station.");

  const selected: T[] = [];
  for (const code of unique) {
    const row = rows.find((r) => r.stationCode === code);
    if (!row) return refuse(`Unknown station code: ${code}.`);
    selected.push(row);
  }

  const companies = Array.from(new Set(selected.map((r) => r.orgName)));
  if (new Set(selected.map((r) => r.orgCode)).size > 1) {
    if (selected.length === 2) {
      const [a, b] = selected;
      return refuse(
        `${a.stationName} and ${b.stationName} belong to separate dealer companies (${a.orgName}, ${b.orgName}) and can't be linked to one user.`
      );
    }
    return refuse(
      `These stations belong to separate dealer companies (${companies.join(", ")}) and can't be linked to one user.`
    );
  }

  const blocked = selected.find((r) => !r.invitable);
  if (blocked) {
    return refuse(
      `Station "${blocked.stationName}" is not invitable yet — partner and station External IDs are required.`
    );
  }

  return { ok: true, orgCode: selected[0].orgCode, orgName: selected[0].orgName, rows: selected };
}
