import type { CreateQuotationInput, OdooClient, OdooProForma, OdooQuotation } from "./types";
import { odooEnv, odooProductIdForKind, ODOO_TRINITY } from "./config";
import type { FuelProductKind } from "./fuel-products";
import { resolveFuelProductExternalId } from "./fuel-products";
import { SALE_ORDER_QUOTATION_FIELDS } from "./quotation-fields";
import { fulfillmentForStation } from "./quotation-contract";
import { epraUnitPriceForStation, type EpraFuelProduct } from "./epra-temp-prices";
import { parseOdooExternalId } from "./external-ids";

type JsonRpcResult<T> = { jsonrpc: string; id: number | null; result?: T; error?: { message: string; data?: unknown } };

const M = ODOO_TRINITY.models;

/**
 * Live Odoo 17 JSON-RPC client for Trinity Energy Kenya (odoo.sh).
 *
 * Models verified against company Models.txt export:
 * - Quotation: sale.order + sale.order.line
 * - Customer: res.partner
 * - Products: product.product (+ product.pricelist for pricing)
 * - PFI: account.move (no dedicated proforma.* model in export)
 * - PDF: ir.attachment (linked to account.move / sale.order)
 *
 * Flow:
 * 1. Portal creates a draft sale.order for the dealer partner.
 * 2. Odoo applies that customer's pricelist.
 * 3. A person in Sales clicks "New" to create the sales pro-forma (PFI).
 * 4. Portal later pulls PFI from account.move (+ attachment for PDF).
 */
export class LiveOdooClient implements OdooClient {
  readonly mode = "live" as const;
  private uid: number | null = null;
  private readonly env = odooEnv();
  /** Cache External ID → database id for this client instance */
  private readonly externalIdCache = new Map<string, number>();

  private async rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
    const res = await fetch(`${this.env.baseUrl}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
        id: Date.now(),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Odoo HTTP ${res.status} from ${this.env.baseUrl}/jsonrpc`);
    }
    const payload = (await res.json()) as JsonRpcResult<T>;
    if (payload.error) {
      throw new Error(payload.error.message || "Odoo JSON-RPC error");
    }
    return payload.result as T;
  }

  private async authenticate(): Promise<number> {
    if (this.uid != null) return this.uid;
    const uid = await this.rpc<number | false>("common", "authenticate", [
      this.env.database,
      this.env.username,
      this.env.apiKey,
      {},
    ]);
    if (!uid) {
      throw new Error("Odoo authentication failed. Check ODOO_USERNAME and ODOO_API_KEY.");
    }
    this.uid = uid;
    return uid;
  }

  private async execute<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) {
    const uid = await this.authenticate();
    return this.rpc<T>("object", "execute_kw", [
      this.env.database,
      uid,
      this.env.apiKey,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  /**
   * Resolve an Odoo External ID (`module.name`) to a database id via ir.model.data.
   */
  private async resolveExternalId(externalId: string, expectedModel?: string): Promise<number> {
    const cached = this.externalIdCache.get(externalId);
    if (cached != null) return cached;

    const { module, name } = parseOdooExternalId(externalId);
    const rows = await this.execute<Array<{ res_id: number; model: string }>>(
      M.modelData,
      "search_read",
      [
        [
          ["module", "=", module],
          ["name", "=", name],
        ],
      ],
      { fields: ["res_id", "model"], limit: 1 }
    );
    const row = rows[0];
    if (!row?.res_id) {
      throw new Error(`Odoo External ID "${externalId}" was not found in ir.model.data.`);
    }
    if (expectedModel && row.model !== expectedModel) {
      throw new Error(
        `Odoo External ID "${externalId}" points to ${row.model}, expected ${expectedModel}.`
      );
    }
    this.externalIdCache.set(externalId, row.res_id);
    return row.res_id;
  }

  /**
   * Resolve source location External ID for sale.order.source_location_id.
   * Exports may be stock.location or stock.quant (product@location) — quants yield location_id.
   */
  private async resolveSourceLocationId(externalId: string): Promise<number> {
    const cached = this.externalIdCache.get(`location:${externalId}`);
    if (cached != null) return cached;

    const { module, name } = parseOdooExternalId(externalId);
    const rows = await this.execute<Array<{ res_id: number; model: string }>>(
      M.modelData,
      "search_read",
      [
        [
          ["module", "=", module],
          ["name", "=", name],
        ],
      ],
      { fields: ["res_id", "model"], limit: 1 }
    );
    const row = rows[0];
    if (!row?.res_id) {
      throw new Error(`Odoo External ID "${externalId}" was not found in ir.model.data.`);
    }

    if (row.model === M.stockLocation) {
      this.externalIdCache.set(`location:${externalId}`, row.res_id);
      return row.res_id;
    }

    if (row.model === M.stockQuant) {
      const quants = await this.execute<Array<{ location_id: [number, string] }>>(
        M.stockQuant,
        "read",
        [[row.res_id], ["location_id"]]
      );
      const locationId = quants[0]?.location_id?.[0];
      if (!locationId) {
        throw new Error(
          `Odoo stock.quant "${externalId}" (id ${row.res_id}) has no location_id.`
        );
      }
      this.externalIdCache.set(`location:${externalId}`, locationId);
      return locationId;
    }

    throw new Error(
      `Odoo External ID "${externalId}" points to ${row.model}; expected ${M.stockLocation} or ${M.stockQuant}.`
    );
  }

  /**
   * Resolve a product External ID to product.product for sale.order.line.product_id.
   * Candidates from Odoo export are product.template — find the related variant.
   */
  private async productId(product: FuelProductKind, explicitId?: number | null): Promise<number> {
    if (explicitId) return explicitId;

    const externalId = resolveFuelProductExternalId(product);
    if (externalId) {
      const { module, name } = parseOdooExternalId(externalId);
      const rows = await this.execute<Array<{ res_id: number; model: string }>>(
        M.modelData,
        "search_read",
        [
          [
            ["module", "=", module],
            ["name", "=", name],
          ],
        ],
        { fields: ["res_id", "model"], limit: 1 }
      );
      const row = rows[0];
      if (!row?.res_id) {
        throw new Error(`Odoo External ID "${externalId}" was not found in ir.model.data.`);
      }

      if (row.model === M.productVariant) {
        this.externalIdCache.set(externalId, row.res_id);
        return row.res_id;
      }

      if (row.model === M.productTemplate) {
        const variantIds = await this.execute<number[]>(
          M.productVariant,
          "search",
          [[["product_tmpl_id", "=", row.res_id]]],
          { limit: 1 }
        );
        if (!variantIds[0]) {
          throw new Error(
            `Odoo product template "${externalId}" (id ${row.res_id}) has no product.product variant.`
          );
        }
        this.externalIdCache.set(externalId, variantIds[0]);
        return variantIds[0];
      }

      throw new Error(
        `Odoo External ID "${externalId}" points to ${row.model}; expected ${M.productTemplate} or ${M.productVariant}.`
      );
    }

    const legacyId = odooProductIdForKind(product);
    if (legacyId) return legacyId;

    throw new Error(
      `Missing Odoo product External ID for ${product}. Set fuel-products.json externalIds.${product} or ODOO_PRODUCT_${product}_EXTERNAL_ID.`
    );
  }

  private async resolvePartnerId(input: CreateQuotationInput): Promise<number> {
    if (input.odooPartnerExternalId) {
      return this.resolveExternalId(input.odooPartnerExternalId, M.partner);
    }
    if (input.odooPartnerId) return input.odooPartnerId;

    const byRef = await this.execute<number[]>(
      M.partner,
      "search",
      [
        [
          ["customer_rank", ">", 0],
          ["ref", "=", input.dealerCode],
        ],
      ],
      { limit: 1 }
    );
    if (byRef[0]) return byRef[0];

    const byName = await this.execute<number[]>(
      M.partner,
      "search",
      [
        [
          ["customer_rank", ">", 0],
          ["name", "=", input.dealerName],
        ],
      ],
      { limit: 1 }
    );
    if (byName[0]) return byName[0];

    throw new Error(
      `No Odoo customer found for dealer "${input.dealerName}" (code ${input.dealerCode}). Set odooPartnerExternalId or odooPartnerId on the dealer organization (${M.partner}).`
    );
  }

  async createQuotation(input: CreateQuotationInput): Promise<OdooQuotation> {
    const existingIds = await this.execute<number[]>(
      M.saleOrder,
      "search",
      [[["client_order_ref", "=", input.idempotencyKey]]],
      { limit: 1 }
    );
    if (existingIds[0]) {
      const existing = await this.getQuotation(String(existingIds[0]));
      if (existing) return existing;
    }

    const partnerId = await this.resolvePartnerId(input);
    const fulfillment = input.stationCode ? fulfillmentForStation(input.stationCode) : null;

    const noteParts = [
      `Portal order: ${input.idempotencyKey}`,
      input.stationName ? `Station: ${input.stationName}` : null,
      fulfillment ? `Loading warehouse: ${fulfillment.warehouseName}` : null,
      fulfillment ? `Source location: ${fulfillment.sourceLocationName}` : null,
      input.requestedDeliveryDate
        ? `Requested delivery: ${input.requestedDeliveryDate.slice(0, 10)}`
        : null,
      input.dealerReference ? `Dealer reference: ${input.dealerReference}` : null,
      input.notes ? `Notes: ${input.notes}` : null,
    ].filter(Boolean);

    const orderLines = await Promise.all(
      input.lines.map(async (line) => {
        const epraProduct = (line.product === "PMS" || line.product === "AGO"
          ? line.product
          : null) as EpraFuelProduct | null;
        const unitPrice =
          line.unitPrice ??
          (input.stationCode && epraProduct
            ? epraUnitPriceForStation(input.stationCode, epraProduct)
            : null);

        return [
          0,
          0,
          {
            /** product.product variant id (API); resolved from External ID when set */
            product_id: await this.productId(line.product, line.odooProductId),
            product_uom_qty: line.quantityLitres,
            ...(unitPrice != null ? { price_unit: unitPrice } : {}),
            name: `${line.product} — ${line.quantityLitres.toLocaleString()} L`,
          },
        ];
      })
    );

    let warehouseId: number | undefined;
    let sourceLocationId: number | undefined;
    let stationId: number | undefined;
    if (fulfillment) {
      warehouseId = await this.resolveExternalId(
        fulfillment.warehouseExternalId,
        "stock.warehouse"
      );
      if (fulfillment.sourceLocationExternalId) {
        sourceLocationId = await this.resolveSourceLocationId(fulfillment.sourceLocationExternalId);
      }
      if (fulfillment.odooStationExternalId) {
        // Model comes from External ID (Banana = account.analytic.account).
        stationId = await this.resolveExternalId(fulfillment.odooStationExternalId);
      } else if (input.odooStationId ?? fulfillment.odooStationId) {
        stationId = input.odooStationId ?? fulfillment.odooStationId ?? undefined;
      }
    } else if (input.odooStationId) {
      stationId = input.odooStationId;
    }

    const orderId = await this.execute<number>(M.saleOrder, "create", [
      {
        partner_id: partnerId,
        /** Fuel dealer portal orders — matches Sale Type selection on the quotation form */
        sale_type: SALE_ORDER_QUOTATION_FIELDS.writable.sale_type.portalDefault,
        /** Invoice + delivery default to the same dealer partner (station noted below) */
        partner_invoice_id: partnerId,
        partner_shipping_id: partnerId,
        client_order_ref: input.idempotencyKey,
        note: noteParts.join("\n"),
        origin: input.idempotencyKey,
        order_line: orderLines,
        ...(stationId != null ? { station_id: stationId } : {}),
        ...(warehouseId != null ? { warehouse_id: warehouseId } : {}),
        ...(sourceLocationId != null ? { source_location_id: sourceLocationId } : {}),
        ...(input.requestedDeliveryDate
          ? { validity_date: input.requestedDeliveryDate.slice(0, 10) }
          : {}),
      },
    ]);

    const rows = await this.execute<
      Array<{ id: number; name: string; amount_total: number; state: string; currency_id: [number, string] }>
    >(M.saleOrder, "read", [[orderId], ["name", "amount_total", "state", "currency_id"]]);

    const row = rows[0];
    if (!row) throw new Error("Odoo created a quotation but read-back failed.");

    return {
      id: String(row.id),
      number: row.name,
      currency: row.currency_id?.[1] || "KES",
      amountTotal: Number(row.amount_total || 0).toFixed(2),
      status: row.state === "sent" || row.state === "sale" ? "sent" : "draft",
      lines: input.lines,
      model: M.saleOrder,
    };
  }

  async getQuotation(quotationId: string): Promise<OdooQuotation | null> {
    const id = Number(quotationId);
    if (!Number.isFinite(id)) return null;
    const rows = await this.execute<
      Array<{ id: number; name: string; amount_total: number; state: string; currency_id: [number, string] }>
    >(M.saleOrder, "read", [[id], ["name", "amount_total", "state", "currency_id"]]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      number: row.name,
      currency: row.currency_id?.[1] || "KES",
      amountTotal: Number(row.amount_total || 0).toFixed(2),
      status: row.state === "sent" || row.state === "sale" ? "sent" : "draft",
      lines: [],
      model: M.saleOrder,
    };
  }

  /**
   * PFI is created manually in Odoo (Sales → New pro-forma).
   * Models.txt has no dedicated proforma.* model — we look up account.move
   * linked to the quotation. PDF bytes (later) come from ir.attachment.
   */
  async generateProForma(quotationId: string): Promise<OdooProForma> {
    const id = Number(quotationId);
    if (!Number.isFinite(id)) throw new Error("Invalid Odoo quotation id.");

    const quotation = await this.getQuotation(quotationId);
    const origin = quotation?.number ?? String(id);

    const moveIds = await this.execute<number[]>(
      M.accountMove,
      "search",
      [
        [
          ["move_type", "in", ["out_invoice", "out_refund"]],
          ["invoice_origin", "ilike", origin],
        ],
      ],
      { limit: 1, order: "id desc" }
    );

    if (!moveIds[0]) {
      throw new Error(
        `No ${M.accountMove} pro-forma/invoice found yet for quotation ${origin}. A commercial user must click New to create the PFI first.`
      );
    }

    const moves = await this.execute<
      Array<{ id: number; name: string; amount_total: number; currency_id: [number, string] }>
    >(M.accountMove, "read", [[moveIds[0]], ["name", "amount_total", "currency_id"]]);
    const move = moves[0];
    if (!move) throw new Error("Odoo PFI read-back failed.");

    return {
      id: String(move.id),
      number: move.name,
      quotationId: String(id),
      amount: Number(move.amount_total || 0).toFixed(2),
      currency: move.currency_id?.[1] || "KES",
    };
  }
}
