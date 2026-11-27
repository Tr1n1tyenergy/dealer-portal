import type {
  CreateQuotationInput,
  OdooClient,
  OdooDriverRecord,
  QuotationTruckInput,
  OdooMpesaPayment,
  OdooOrderDocument,
  OdooPaymentState,
  OdooQuotation,
  PaidOrderFulfillment,
  PaymentDraftInput,
} from "./types";
import {
  odooEnv,
  odooPaymentsEnabled,
  odooProductIdForKind,
  ODOO_KES_CURRENCY_ID,
  ODOO_MPESA_JOURNAL_ID,
  ODOO_TRINITY,
} from "./config";
import type { FuelProductKind } from "./fuel-products";
import { resolveFuelProductExternalId } from "./fuel-products";
import { fulfillmentForStation } from "./quotation-contract";
import { dealerUnitPriceForStation, type DealerFuelProduct } from "./dealer-prices";
import { parseOdooExternalId } from "./external-ids";
import { nairobiDatePlusMonth } from "@/lib/time/nairobi";

type JsonRpcResult<T> = { jsonrpc: string; id: number | null; result?: T; error?: { message: string; data?: unknown } };

const M = ODOO_TRINITY.models;

/**
 * Live Odoo 17 JSON-RPC client for Trinity Energy Kenya (odoo.sh). The portal creates a
 * sale.order (quotation) for the dealer's res.partner with the portal's EPRA-based unit prices
 * and HOD-approves it before returning. The quotation stays valid for one month from the order.
 * the PFI is issued by the portal itself (src/lib/orders/pfi-*.ts), not by Odoo.
 */
export class LiveOdooClient implements OdooClient {
  readonly mode = "live" as const;
  private uid: number | null = null;
  private readonly env = odooEnv();
  /** Cache External ID → database id for this client instance */
  private readonly externalIdCache = new Map<string, number>();
  /** A hung Odoo fails the call (order → ODOO_SYNC_FAILED, staff retry) instead of hanging the request. */
  private timeoutMs = 8_000;

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
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Odoo HTTP ${res.status} from ${this.env.baseUrl}/jsonrpc`);
    }
    const payload = (await res.json()) as JsonRpcResult<T>;
    if (payload.error) {
      const data = payload.error.data as { message?: string } | undefined;
      const detail = typeof data?.message === "string" ? data.message.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      throw new Error(detail || payload.error.message || "Odoo JSON-RPC error");
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

  private async resolvePartnerId(
    input: Pick<CreateQuotationInput, "dealerCode" | "dealerName" | "odooPartnerId" | "odooPartnerExternalId">
  ): Promise<number> {
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
    // No match by name: two Odoo customers can share one, and the quotation would go to the wrong one.

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
    const validityDate = nairobiDatePlusMonth(input.orderedAt ? new Date(input.orderedAt) : new Date());
    if (existingIds[0]) {
      if (input.trucks?.length) await this.attachTruckLines(existingIds[0], input.trucks);
      await this.approveFuelQuotation(existingIds[0], validityDate);
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
          : null) as DealerFuelProduct | null;
        const unitPrice =
          line.unitPrice ??
          (input.stationCode && epraProduct
            ? await dealerUnitPriceForStation(input.stationCode, epraProduct)
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
        sale_type: "fuels",
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
        validity_date: validityDate,
        ...(input.trucks?.length ? { truck_line_ids: this.truckLineCommands(input.trucks) } : {}),
      },
    ]);
    await this.approveFuelQuotation(orderId, validityDate);

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

  /**
   * A new fuel quotation is created as a draft. Submit it and approve it as HOD so it is ready
   * to book once the dealer has paid. A quotation that is already past that step is left as it is.
   * Driver - Truck Details lines. Related plate and EPRA fields are read from truck.driver
   * and are not writable. Capacity and the linked contact are stored on the line.
   * This does not create a delivery order.
   */
  private truckLineCommands(trucks: QuotationTruckInput[]) {
    return trucks.map((truck) => [
      0,
      0,
      {
        truck_details_id: truck.odooDriverRecordId,
        capacity: truck.capacityLitres,
        ...(truck.odooContactId ? { driver_id: truck.odooContactId } : {}),
      },
    ]);
  }

  private async attachTruckLines(saleOrderId: number, trucks: QuotationTruckInput[]) {
    if (trucks.length === 0) return;
    const existing = await this.execute<Array<{ truck_details_id: [number, string] | false }>>(
      "sale.order.truck",
      "search_read",
      [[["order_id", "=", saleOrderId]]],
      { fields: ["truck_details_id"] }
    );
    const attached = new Set(
      existing.flatMap((row) => (Array.isArray(row.truck_details_id) ? [row.truck_details_id[0]] : []))
    );
    const missing = trucks.filter((truck) => !attached.has(truck.odooDriverRecordId));
    if (missing.length === 0) return;
    await this.execute("sale.order", "write", [[saleOrderId], { truck_line_ids: this.truckLineCommands(missing) }]);
  }

  async listDriverRecords(): Promise<OdooDriverRecord[]> {
    type RawDriver = {
      id: number;
      name: string;
      driver_no: string | false;
      driver_epra: string | false;
      truck_details: string | false;
      truck_epra: string | false;
      partner_id: [number, string] | false;
      delivery_truck_id: [number, string] | false;
    };
    const drivers = await this.execute<RawDriver[]>(
      "truck.driver",
      "search_read",
      [[]],
      {
        fields: ["name", "driver_no", "driver_epra", "truck_details", "truck_epra", "partner_id", "delivery_truck_id"],
        order: "name asc, id asc",
        limit: 500,
      }
    );
    const truckIds = [...new Set(drivers.flatMap((row) => (Array.isArray(row.delivery_truck_id) ? [row.delivery_truck_id[0]] : [])))];
    const capacities = new Map<number, number>();
    if (truckIds.length > 0) {
      const trucks = await this.execute<Array<{ id: number; total_capacity: number }>>(
        "delivery.truck",
        "read",
        [truckIds, ["total_capacity"]]
      );
      for (const truck of trucks) capacities.set(truck.id, Number(truck.total_capacity) || 0);
    }
    const text = (value: string | false) => (typeof value === "string" && value.trim() ? value.trim() : null);
    return drivers.map((row) => {
      const truck = Array.isArray(row.delivery_truck_id) ? row.delivery_truck_id : null;
      const contact = Array.isArray(row.partner_id) ? row.partner_id : null;
      return {
        id: row.id,
        driverName: row.name,
        driverNo: text(row.driver_no) ?? "",
        driverEpra: text(row.driver_epra),
        truckDetails: text(row.truck_details),
        assignedTruckName: truck ? text(truck[1]) : null,
        truckPlate: text(row.truck_details) ?? (truck ? text(truck[1]) : null),
        truckEpra: text(row.truck_epra),
        capacityLitres: truck ? capacities.get(truck[0]) ?? 0 : 0,
        contactId: contact ? contact[0] : null,
        contactName: contact ? text(contact[1]) : null,
        fleetTruckId: truck ? truck[0] : null,
      };
    });
  }

  /**
   * A cancelled quotation is not reopened here.
   */
  private async approveFuelQuotation(saleOrderId: number, validityDate: string) {
    const read = async () => {
      const rows = await this.execute<
        Array<{ id: number; name: string; state: string; approval_status: string }>
      >(M.saleOrder, "read", [[saleOrderId], ["name", "state", "approval_status"]]);
      const row = rows[0];
      if (!row) throw new Error(`Odoo sales order ${saleOrderId} was not found.`);
      return row;
    };
    let order = await read();
    if (order.state === "cancel") {
      throw new Error(`Odoo quotation ${order.name} is cancelled, so it cannot be approved.`);
    }
    const pastHod = ["hod_approved", "order_booking", "hold", "cs_review", "pending_hod_marketing", "approved"];
    if (pastHod.includes(order.approval_status) || order.state === "sale" || order.state === "done") return;

    await this.execute(M.saleOrder, "write", [[saleOrderId], { validity_date: validityDate }]);
    if (order.approval_status === "draft") {
      await this.execute(M.saleOrder, "action_submit_for_approval", [[saleOrderId]]);
      order = await read();
    }
    if (order.approval_status === "pending_hod") {
      await this.execute(M.saleOrder, "action_hod_approve_quotation", [[saleOrderId]]);
      order = await read();
    }
    if (order.approval_status !== "hod_approved" && !pastHod.includes(order.approval_status)) {
      throw new Error(`Odoo left ${order.name} as “${order.approval_status}” instead of an HOD-approved quotation.`);
    }
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

  private assertPaymentsEnabled() {
    if (!odooPaymentsEnabled()) {
      throw new Error("Odoo payments are switched off (set ODOO_PAYMENTS_LIVE=1 after the approved live test).");
    }
  }

  private async paymentState(id: number): Promise<OdooPaymentState> {
    const rows = await this.execute<Array<{ id: number; state: string }>>(M.payment, "read", [[id], ["state"]]);
    if (!rows[0]) throw new Error(`Odoo payment ${id} was not found.`);
    return { id, state: rows[0].state };
  }

  async createPaymentDraft(input: PaymentDraftInput): Promise<OdooPaymentState> {
    this.assertPaymentsEnabled();
    const partnerId = await this.resolvePartnerId(input);
    const amount = Number(input.amount);
    // A retry after a crash must not make a second draft: reuse the identical one.
    const existing = await this.execute<number[]>(
      M.payment,
      "search",
      [
        [
          ["partner_id", "=", partnerId],
          ["journal_id", "=", input.journalId],
          ["amount", "=", amount],
          ["ref", "=", input.reference],
          ["state", "=", "draft"],
        ],
      ],
      { limit: 1 }
    );
    if (existing[0]) return { id: existing[0], state: "draft" };
    const id = await this.execute<number>(M.payment, "create", [
      {
        is_internal_transfer: false,
        payment_type: "inbound",
        partner_type: "customer",
        partner_id: partnerId,
        amount,
        currency_id: input.currencyId ?? ODOO_KES_CURRENCY_ID,
        date: input.date,
        ref: input.reference,
        journal_id: input.journalId,
        payment_method_line_id: input.paymentMethodLineId,
        partner_bank_id: input.partnerBankId,
      },
    ]);
    return { id, state: "draft" };
  }

  async writePaymentDraft(id: number, input: PaymentDraftInput): Promise<OdooPaymentState> {
    this.assertPaymentsEnabled();
    const before = await this.paymentState(id);
    if (before.state !== "draft") return before;
    await this.execute(M.payment, "write", [
      [id],
      {
        amount: Number(input.amount),
        currency_id: input.currencyId ?? ODOO_KES_CURRENCY_ID,
        date: input.date,
        ref: input.reference,
        journal_id: input.journalId,
        payment_method_line_id: input.paymentMethodLineId,
        partner_bank_id: input.partnerBankId,
      },
    ]);
    return this.paymentState(id);
  }

  async listCurrencies() {
    const rows = await this.execute<Array<{ id: number; name: string }>>(
      "res.currency",
      "search_read",
      [[["active", "=", true]]],
      { fields: ["name"], limit: 40 }
    );
    const list = rows.map((row) => ({ id: row.id, code: row.name }));
    if (!list.some((row) => row.id === ODOO_KES_CURRENCY_ID)) list.unshift({ id: ODOO_KES_CURRENCY_ID, code: "KES" });
    return list;
  }

  /** The draft's Confirm button (account.payment.action_post); the caller checks the state is "posted". */
  async postPayment(id: number): Promise<OdooPaymentState> {
    this.assertPaymentsEnabled();
    // Only a draft is posted: a payment already posted (a timed-out earlier try, or Accounts pressing
    // Confirm in Odoo) is reported as it is, so the portal can catch up instead of failing for ever.
    const before = await this.paymentState(id);
    if (before.state !== "draft") return before;
    await this.execute(M.payment, "action_post", [[id]]);
    return this.paymentState(id);
  }

  async cancelPayment(id: number): Promise<OdooPaymentState> {
    this.assertPaymentsEnabled();
    // Never cancel a posted payment: in Odoo that un-posts money Trinity really received.
    const before = await this.paymentState(id);
    if (before.state !== "draft") return before;
    await this.execute(M.payment, "action_cancel", [[id]]);
    return this.paymentState(id);
  }

  async findMpesaPayment(code: string): Promise<OdooMpesaPayment | null> {
    const rows = await this.execute<Array<{ id: number; ref: string | false; amount: number; date: string; state: string }>>(
      M.payment,
      "search_read",
      [
        [
          ["journal_id", "=", ODOO_MPESA_JOURNAL_ID],
          ["state", "=", "posted"],
          ["ref", "ilike", code],
        ],
      ],
      { fields: ["ref", "amount", "date", "state"], limit: 5 }
    );
    // Odoo's M-PESA refs look like "MP-<digits> - <payer> - <CODE>": only the last part is the code.
    const matches = rows.filter((row) => typeof row.ref === "string" && row.ref.trim().endsWith(` - ${code}`));
    if (matches.length > 1) throw new Error("This M-PESA code matches more than one Odoo payment.");
    const row = matches[0];
    return row
      ? { id: row.id, amount: Number(row.amount).toFixed(2), date: row.date, state: row.state, ref: String(row.ref).trim() }
      : null;
  }

  private async sessionCookie(): Promise<string> {
    const res = await fetch(`${this.env.baseUrl}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { db: this.env.database, login: this.env.username, password: this.env.apiKey },
      }),
      cache: "no-store",
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    const session = cookie.match(/session_id=([^;]+)/)?.[1];
    if (!session) throw new Error("Odoo did not open a session for the document.");
    return `session_id=${session}`;
  }

  private async renderPdf(reportName: string, ids: number[], cookie: string): Promise<Buffer> {
    const res = await fetch(`${this.env.baseUrl}/report/pdf/${reportName}/${ids.join(",")}`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Odoo report ${reportName} returned HTTP ${res.status}.`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Odoo report ${reportName} was not a PDF.`);
    return bytes;
  }

  private async readSale(id: number) {
    const rows = await this.execute<
      Array<{
        id: number;
        name: string;
        state: string;
        approval_status: string;
        invoice_ids: number[];
        picking_ids: number[];
      }>
    >(M.saleOrder, "read", [[id], ["name", "state", "approval_status", "invoice_ids", "picking_ids"]]);
    const row = rows[0];
    if (!row) throw new Error(`Odoo sales order ${id} was not found.`);
    return row;
  }

  private async readInvoice(id: number) {
    const rows = await this.execute<
      Array<{
        id: number;
        name: string;
        state: string;
        reviewed_by_id: [number, string] | false;
        approved_by_id: [number, string] | false;
        l10n_ke_oscu_invoice_number: string | false;
        l10n_ke_oscu_receipt_number: string | false;
        l10n_ke_validation_message: string | false;
      }>
    >("account.move", "read", [
      [id],
      [
        "name",
        "state",
        "reviewed_by_id",
        "approved_by_id",
        "l10n_ke_oscu_invoice_number",
        "l10n_ke_oscu_receipt_number",
        "l10n_ke_validation_message",
      ],
    ]);
    const row = rows[0];
    if (!row) throw new Error(`Odoo invoice ${id} was not found.`);
    return row;
  }

  /**
   * Walk the fuel buttons this API user can press: send for approval, approve the quotation,
   * book, submit to the CS manager, then approve and confirm. Each call is skipped once Odoo
   * has moved past that status.
   */
  private async advanceFuelOrder(saleOrderId: number) {
    for (let step = 0; step < 6; step += 1) {
      const order = await this.readSale(saleOrderId);
      if (order.state === "cancel") {
        throw new Error(`Odoo quotation ${order.name} is cancelled, so it cannot be booked.`);
      }
      if (order.approval_status === "approved" && (order.state === "sale" || order.state === "done")) return order;
      const before = `${order.state}:${order.approval_status}`;
      let method: string | null = null;
      if (order.approval_status === "draft") method = "action_submit_for_approval";
      else if (order.approval_status === "pending_hod") method = "action_hod_approve_quotation";
      else if (order.approval_status === "hod_approved" || order.approval_status === "hold") method = "action_book_order";
      else if (order.approval_status === "order_booking" || order.approval_status === "cs_review") {
        method = "action_submit_to_hod_marketing";
      } else if (order.approval_status === "pending_hod_marketing") method = "action_hod_marketing_approve";
      if (!method) {
        throw new Error(`Odoo left ${order.name} in “${order.approval_status}”, which the portal cannot move.`);
      }
      await this.execute(M.saleOrder, method, [[saleOrderId]]);
      const after = await this.readSale(saleOrderId);
      if (`${after.state}:${after.approval_status}` === before) {
        throw new Error(`Odoo did not move ${order.name} when ${method} ran (still ${order.approval_status}).`);
      }
    }
    return this.readSale(saleOrderId);
  }

  async fulfillPaidOrder(saleOrderId: number): Promise<PaidOrderFulfillment> {
    let order = await this.advanceFuelOrder(saleOrderId);
    if (order.approval_status !== "approved") {
      throw new Error(`Odoo did not confirm ${order.name}. It is still “${order.approval_status}”.`);
    }

    if (order.invoice_ids.length === 0) {
      const wizardId = await this.execute<number>("sale.advance.payment.inv", "create", [
        {
          advance_payment_method: "delivered",
          sale_order_ids: [[6, 0, [saleOrderId]]],
        },
      ]);
      await this.execute("sale.advance.payment.inv", "create_invoices", [[wizardId]]);
      order = await this.readSale(saleOrderId);
    }
    const invoiceId = order.invoice_ids[0] ?? null;
    if (invoiceId == null) throw new Error(`Odoo confirmed ${order.name} but did not create an invoice.`);

    let invoice = await this.readInvoice(invoiceId);
    if (invoice.state !== "posted") {
      if (!invoice.reviewed_by_id) await this.execute("account.move", "action_trinity_review", [[invoiceId]]);
      invoice = await this.readInvoice(invoiceId);
      if (!invoice.approved_by_id) await this.execute("account.move", "action_trinity_approve", [[invoiceId]]);
      invoice = await this.readInvoice(invoiceId);
      if (invoice.state !== "posted") await this.execute("account.move", "action_post", [[invoiceId]]);
    }
    for (let attempt = 0; attempt < 4 && !invoice.l10n_ke_oscu_invoice_number; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      invoice = await this.readInvoice(invoiceId);
    }
    order = await this.readSale(saleOrderId);
    const pickingId = order.picking_ids[0] ?? null;
    const etimsInvoiceNumber = invoice.l10n_ke_oscu_invoice_number || null;
    const documents: OdooOrderDocument[] = [];
    const problems: string[] = [];
    if (etimsInvoiceNumber) {
      try {
        const cookie = await this.sessionCookie();
        const jobs: Array<{ kind: OdooOrderDocument["kind"]; report: string; ids: number[]; fileName: string }> = [
          {
            kind: "etims-invoice",
            report: "account.report_invoice_with_payments",
            ids: [invoiceId],
            fileName: `eTIMS-${invoice.name || invoiceId}.pdf`,
          },
          {
            kind: "sale-order",
            report: "delivery_report.sale_order_report",
            ids: [saleOrderId],
            fileName: `Sale-order-${order.name}.pdf`,
          },
        ];
        if (pickingId != null) {
          jobs.push(
            {
              kind: "loading-order",
              report: "delivery_report.loading_order_report",
              ids: [pickingId],
              fileName: `Loading-order-${order.name}.pdf`,
            },
            {
              kind: "gate-pass",
              report: "delivery_report.gate_pass_report",
              ids: [pickingId],
              fileName: `Gate-pass-${order.name}.pdf`,
            },
          );
        } else {
          problems.push("Odoo has not created the delivery yet, so the loading order and gate pass are not ready.");
        }
        for (const job of jobs) {
          try {
            documents.push({ kind: job.kind, fileName: job.fileName, bytes: await this.renderPdf(job.report, job.ids, cookie) });
          } catch (error) {
            problems.push(error instanceof Error ? error.message : String(error));
          }
        }
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }
    const validation = invoice.l10n_ke_validation_message
      ? String(invoice.l10n_ke_validation_message).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "";
    if (!etimsInvoiceNumber && validation) problems.push(validation);
    return {
      approvalStatus: order.approval_status,
      saleState: order.state,
      invoiceId,
      invoiceNumber: invoice.name || null,
      pickingId,
      etimsInvoiceNumber,
      etimsReceiptNumber: invoice.l10n_ke_oscu_receipt_number || null,
      documents,
      documentError: problems.length ? problems.join(" ") : null,
    };
  }
}
