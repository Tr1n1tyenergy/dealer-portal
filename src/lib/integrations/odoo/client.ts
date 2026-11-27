import type {
  CreateQuotationInput,
  OdooClient,
  OdooCurrency,
  OdooDriverRecord,
  OdooMpesaPayment,
  OdooPaymentState,
  OdooQuotation,
  PaymentDraftInput,
} from "./types";
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

const mockPayments = new Map<string, OdooPaymentState>();
let mockPaymentId = 900000;
/** Test M-PESA codes the mock "finds"; anything else is not in Odoo. */
const MOCK_MPESA: Record<string, string> = { TEST000001: "1000.00", TEST500000: "500000.00" };

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
  return {
    id: `${MOCK_QUOTATION_PREFIX}${amountTotal}-${idempotencyKey}`,
    // The whole hash, so two orders don't share a number (a PFI number must be unique).
    number: `${mockCommercialDocumentPrefix()}-S${hashKey(idempotencyKey).toString(36).toUpperCase()}`,
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

  async listDriverRecords(): Promise<OdooDriverRecord[]> {
    return [];
  }

  async getQuotation(quotationId: string): Promise<OdooQuotation | null> {
    for (const entry of memory.values()) {
      if (entry.quotation.id === quotationId) return entry.quotation;
    }
    return null;
  }

  async createPaymentDraft(input: PaymentDraftInput): Promise<OdooPaymentState> {
    const existing = mockPayments.get(input.idempotencyKey);
    if (existing) return { ...existing };
    const payment = { id: ++mockPaymentId, state: "draft" };
    mockPayments.set(input.idempotencyKey, payment);
    return { ...payment };
  }

  async writePaymentDraft(id: number): Promise<OdooPaymentState> {
    return this.setPaymentState(id, "draft");
  }

  async listCurrencies() {
    return [{ id: 92, code: "KES" }];
  }

  async postPayment(id: number): Promise<OdooPaymentState> {
    return this.setPaymentState(id, "posted");
  }

  async cancelPayment(id: number): Promise<OdooPaymentState> {
    return this.setPaymentState(id, "cancel");
  }

  async fulfillPaidOrder(): Promise<never> {
    throw new Error("Mock Odoo does not book live orders.");
  }

  async findMpesaPayment(code: string): Promise<OdooMpesaPayment | null> {
    const amount = MOCK_MPESA[code];
    return amount
      ? { id: 800000 + Number(code.slice(-6)), amount, date: "2026-11-19", state: "posted", ref: `MP-254700000000 - Test Payer - ${code}` }
      : null;
  }

  /** Like Odoo after the live client's checks: only a draft moves; anything else is left as it is. */
  private setPaymentState(id: number, state: string): OdooPaymentState {
    for (const payment of mockPayments.values()) {
      if (payment.id === id) {
        if (payment.state === "draft") payment.state = state;
        return { ...payment };
      }
    }
    // A draft made by another server instance: the mock just answers as Odoo would.
    return { id, state };
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
  async listDriverRecords(): Promise<OdooDriverRecord[]> {
    this.fail();
  }
  async getQuotation(): Promise<OdooQuotation | null> {
    this.fail();
  }
  async createPaymentDraft(): Promise<OdooPaymentState> {
    this.fail();
  }
  async writePaymentDraft(): Promise<OdooPaymentState> {
    this.fail();
  }
  async listCurrencies(): Promise<OdooCurrency[]> {
    this.fail();
  }
  async postPayment(): Promise<OdooPaymentState> {
    this.fail();
  }
  async cancelPayment(): Promise<OdooPaymentState> {
    this.fail();
  }
  async findMpesaPayment(): Promise<OdooMpesaPayment | null> {
    this.fail();
  }
  async fulfillPaidOrder(): Promise<never> {
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
