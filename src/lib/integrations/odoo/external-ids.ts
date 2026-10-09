/**
 * Odoo External IDs (XML IDs) are the portal's stable identifiers.
 * JSON-RPC many2one fields still need numeric database IDs, so live mode
 * resolves `__export__.model_…` via ir.model.data at call time.
 */

export type OdooExternalId = `${string}.${string}`;

export function parseOdooExternalId(externalId: string): { module: string; name: string } {
  const trimmed = externalId.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) {
    throw new Error(`Invalid Odoo External ID "${externalId}". Expected module.name (e.g. __export__.stock_warehouse_138_…).`);
  }
  return {
    module: trimmed.slice(0, dot),
    name: trimmed.slice(dot + 1),
  };
}

export function isOdooExternalId(value: string | null | undefined): value is string {
  return Boolean(value && value.includes(".") && !value.startsWith("."));
}
