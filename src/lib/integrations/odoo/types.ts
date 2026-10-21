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
  dealerReference?: string | null;
  notes?: string | null;
  lines: OdooOrderLineInput[];
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

export interface OdooClient {
  readonly mode: "mock" | "live";
  createQuotation(input: CreateQuotationInput): Promise<OdooQuotation>;
  getQuotation(quotationId: string): Promise<OdooQuotation | null>;
}
