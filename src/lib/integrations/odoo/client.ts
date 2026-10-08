import type { CreateQuotationInput, OdooClient, OdooProForma, OdooQuotation } from "./types";
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
const memory = new Map<string, { quotation: OdooQuotation; proforma?: OdooProForma }>();

function hashKey(key: string) {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 33 + key.charCodeAt(i)) >>> 0;
  return n;
}

export class MockOdooClient implements OdooClient {
  readonly mode = "mock" as const;

  async createQuotation(input: CreateQuotationInput): Promise<OdooQuotation> {
    const existing = memory.get(input.idempotencyKey);
    if (existing) return existing.quotation;

    const n = hashKey(input.idempotencyKey) % 90000;
    const prefix = mockCommercialDocumentPrefix();
    const quotation: OdooQuotation = {
      id: `mock-quot-${input.idempotencyKey}`,
      number: `${prefix}-S${String(10000 + (n % 89999)).padStart(5, "0")}`,
      currency: "KES",
      amountTotal: "0.00",
      status: "draft",
      lines: input.lines,
      model: "sale.order",
    };
    memory.set(input.idempotencyKey, { quotation });
    return quotation;
  }

  async getQuotation(quotationId: string): Promise<OdooQuotation | null> {
    for (const entry of memory.values()) {
      if (entry.quotation.id === quotationId) return entry.quotation;
    }
    return null;
  }

  async generateProForma(quotationId: string): Promise<OdooProForma> {
    for (const [key, entry] of memory.entries()) {
      if (entry.quotation.id !== quotationId) continue;
      if (entry.proforma) return entry.proforma;
      const prefix = mockCommercialDocumentPrefix();
      const proforma: OdooProForma = {
        id: `mock-pfi-${key}`,
        number: `${prefix}-PFI-${entry.quotation.number.replace(/^MOCK-/, "")}`,
        quotationId,
        amount: entry.quotation.amountTotal,
        currency: entry.quotation.currency,
      };
      entry.proforma = proforma;
      return proforma;
    }
    throw new Error("Quotation not found in the development Odoo adapter.");
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
  async generateProForma(): Promise<OdooProForma> {
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
