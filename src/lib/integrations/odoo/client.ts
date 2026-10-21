import type { CreateQuotationInput, OdooClient, OdooQuotation } from "./types";
import { odooConfigured, odooEnv } from "./config";
import { LiveOdooClient } from "./live-client";
import { mockCommercialDocumentPrefix } from "@/lib/security/launch-mode";

/**
 * Development adapter.
 *
 * Live Odoo uses JSON-RPC against trinityenergykenya.odoo.com (sale.order).
 * Keep ODOO_MODE=mock for local UI work without touching production.
 * Mock document numbers are always prefixed so they cannot be mistaken for live docs.
 */
const memory = new Map<string, { quotation: OdooQuotation }>();

function hashKey(key: string) {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 33 + key.charCodeAt(i)) >>> 0;
  return n;
}

const MOCK_QUOTATION_PREFIX = "mock-quot-";

/** Litres x unit price per line, each rounded to cents; a line with no price counts as 0. */
function mockAmountTotal(lines: CreateQuotationInput["lines"]): string {
  const cents = lines.reduce(
    (sum, line) => sum + Math.round(line.quantityLitres * (line.unitPrice ?? 0) * 100),
    0
  );
  return (cents / 100).toFixed(2);
}

/** Mock quotations are derived from their idempotency key; the id is mock-quot-<total>-<key>. */
function mockQuotation(idempotencyKey: string, amountTotal: string, lines: CreateQuotationInput["lines"]): OdooQuotation {
  const n = hashKey(idempotencyKey) % 90000;
  return {
    id: `${MOCK_QUOTATION_PREFIX}${amountTotal}-${idempotencyKey}`,
    number: `${mockCommercialDocumentPrefix()}-S${String(10000 + (n % 89999)).padStart(5, "0")}`,
    currency: "KES",
    amountTotal,
    status: "draft",
    lines,
    model: "sale.order",
  };
}

export class MockOdooClient implements OdooClient {
  readonly mode = "mock" as const;

  async createQuotation(input: CreateQuotationInput): Promise<OdooQuotation> {
    const existing = memory.get(input.idempotencyKey);
    if (existing) return existing.quotation;

    const quotation = mockQuotation(input.idempotencyKey, mockAmountTotal(input.lines), input.lines);
    memory.set(input.idempotencyKey, { quotation });
    return quotation;
  }

  async getQuotation(quotationId: string): Promise<OdooQuotation | null> {
    for (const entry of memory.values()) {
      if (entry.quotation.id === quotationId) return entry.quotation;
    }
    return null;
  }
}

export class UnconfiguredOdooClient implements OdooClient {
  readonly mode = "live" as const;

  private fail(): never {
    throw new Error(
      "Odoo live mode is selected but credentials are incomplete. Set ODOO_USERNAME and ODOO_API_KEY (and product IDs), or use ODOO_MODE=mock."
    );
  }

  async createQuotation(): Promise<OdooQuotation> {
    this.fail();
  }
  async getQuotation(): Promise<OdooQuotation | null> {
    this.fail();
  }
}

export { odooConfigured } from "./config";

export function getOdooClient(): OdooClient {
  const env = odooEnv();
  if (env.mode === "live") {
    if (!odooConfigured()) return new UnconfiguredOdooClient();
    return new LiveOdooClient();
  }
  return new MockOdooClient();
}
