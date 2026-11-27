import type { FuelProductKind } from "./fuel-products";

export type OdooOrderLineInput = {
  /** Fuel kind — mapped to product.product via fuel-products.json / env */
  product: FuelProductKind;
  /** Optional explicit Odoo product.product id (dealer-specific variant) */
  odooProductId?: number | null;
  /** Maps to sale.order.line.product_uom_qty */
  quantityLitres: number;
  /** Maps to sale.order.line.price_unit (temporary EPRA regional until Odoo pricelists own this) */
  unitPrice?: number | null;
};

/** A truck.driver row the dealer chose. The quotation line stores the record, the contact and the capacity. */
export type QuotationTruckInput = {
  /** truck.driver id */
  odooDriverRecordId: number;
  /** res.partner id on that driver record. Omitted on the quotation line when absent. */
  odooContactId?: number | null;
  capacityLitres: number;
};

/** truck.driver, with the assigned fleet truck's capacity filled in. */
export type OdooDriverRecord = {
  id: number;
  driverName: string;
  driverNo: string;
  driverEpra: string | null;
  truckPlate: string | null;
  truckEpra: string | null;
  /** truck.driver.truck_details, as stored. Not filled in from the assigned truck. */
  truckDetails: string | null;
  /** delivery.truck display name when the driver record has an assigned truck. */
  assignedTruckName: string | null;
  capacityLitres: number;
  contactId: number | null;
  contactName: string | null;
  fleetTruckId: number | null;
};

export type CreateQuotationInput = {
  /** Stable key. Retries with the same key must not create a second quotation. */
  idempotencyKey: string;
  dealerCode: string;
  dealerName: string;
  /** Odoo res.partner id for this dealer — preferred over name/code search. */
  odooPartnerId?: number | null;
  /** Odoo res.partner External ID — preferred over numeric id when present. */
  odooPartnerExternalId?: string | null;
  stationName: string;
  /** Portal station code — resolves warehouse, source location, temp EPRA price */
  stationCode?: string | null;
  /** station.station id for sale.order.station_id */
  odooStationId?: number | null;
  requestedDeliveryDate?: string | null;
  /** When the dealer placed the order. The quotation stays valid for one month from this instant. */
  orderedAt?: string | null;
  dealerReference?: string | null;
  notes?: string | null;
  lines: OdooOrderLineInput[];
  /** Driver records written onto the quotation as Driver - Truck Details lines. */
  trucks?: QuotationTruckInput[];
};

export type OdooQuotation = {
  id: string;
  number: string;
  currency: string;
  amountTotal: string;
  status: "draft" | "sent";
  lines: OdooOrderLineInput[];
  model?: string;
};

/** A dealer's manual bank payment, as Accounts would type it into an Odoo account.payment draft. */
export type PaymentDraftInput = {
  /** Stable key (payment:<PaymentRecord id>); the mock uses it, the live client matches on the fields. */
  idempotencyKey: string;
  dealerCode: string;
  dealerName: string;
  odooPartnerId?: number | null;
  odooPartnerExternalId?: string | null;
  amount: string;
  /** YYYY-MM-DD, Nairobi */
  date: string;
  /** The dealer's bank reference (account.payment.ref) */
  reference: string;
  journalId: number;
  paymentMethodLineId: number;
  partnerBankId: number;
  /** res.currency id. Omitted means KES. */
  currencyId?: number;
};

export type OdooCurrency = { id: number; code: string };

export type OdooPaymentState = { id: number; state: string };
export type OdooMpesaPayment = { id: number; amount: string; date: string; state: string; ref: string };

export type OdooOrderDocumentKind = "etims-invoice" | "sale-order" | "loading-order" | "gate-pass";

export type OdooOrderDocument = {
  kind: OdooOrderDocumentKind;
  fileName: string;
  bytes: Buffer;
};

/** What Odoo holds after a paid fuel order is booked, approved and invoiced. */
export type PaidOrderFulfillment = {
  approvalStatus: string;
  saleState: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  pickingId: number | null;
  etimsInvoiceNumber: string | null;
  etimsReceiptNumber: string | null;
  documents: OdooOrderDocument[];
  documentError: string | null;
};

export interface OdooClient {
  readonly mode: "mock" | "live";
  createQuotation(input: CreateQuotationInput): Promise<OdooQuotation>;
  getQuotation(quotationId: string): Promise<OdooQuotation | null>;
  createPaymentDraft(input: PaymentDraftInput): Promise<OdooPaymentState>;
  /** Every truck.driver row, with capacity taken from the assigned delivery.truck. */
  listDriverRecords(): Promise<OdooDriverRecord[]>;
  /** Rewrites a draft with the payment the staff member just reviewed. A posted payment is left as it is. */
  writePaymentDraft(id: number, input: PaymentDraftInput): Promise<OdooPaymentState>;
  listCurrencies(): Promise<OdooCurrency[]>;
  postPayment(id: number): Promise<OdooPaymentState>;
  cancelPayment(id: number): Promise<OdooPaymentState>;
  /** A posted payment in Odoo's M-PESA journal whose reference ends with this code; null if none. */
  findMpesaPayment(code: string): Promise<OdooMpesaPayment | null>;
  /**
   * Book a paid fuel quotation, approve it, create the invoice and post it so KRA can brand it.
   * Safe to call again: a step Odoo has already passed is not repeated.
   */
  fulfillPaidOrder(saleOrderId: number): Promise<PaidOrderFulfillment>;
}
