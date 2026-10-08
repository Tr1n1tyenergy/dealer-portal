/**
 * Quotation form field map — confirmed from Odoo developer-mode tooltips
 * (Sales → New Quotation, 2026-10-05) + live sale.order fields_get.
 *
 * All fields live on model `sale.order` unless noted. Related models are
 * present in reference-models.txt.
 */
export const SALE_ORDER_QUOTATION_FIELDS = {
  /** Writable on create — portal should set these */
  writable: {
    partner_id: {
      label: "Customer",
      type: "many2one",
      relation: "res.partner",
      required: true,
      note: "Dealer res.partner id. Domain filters contact_approval_state approved/draft/false.",
    },
    sale_type: {
      label: "Sale Type",
      type: "selection",
      required: true,
      selection: {
        fuels: "Fuels",
        specialty: "Specialty",
        regular: "Regular",
        pos_po_type: "POS PO Type",
        engineering: "Engineering",
        it_po_typo: "IT PO Type",
        office_admin: "Office Admin",
      },
      portalDefault: "fuels",
    },
    partner_invoice_id: {
      label: "Invoice Address",
      type: "many2one",
      relation: "res.partner",
      required: true,
      note: "Defaults from customer; set to same partner_id unless a separate invoice contact exists.",
    },
    partner_shipping_id: {
      label: "Delivery Address",
      type: "many2one",
      relation: "res.partner",
      required: true,
      note: "Defaults from customer; station is not a separate partner — use dealer partner + note.",
    },
    date_order: {
      label: "Quotation Date / Order Date",
      type: "datetime",
      required: true,
      note: "Odoo defaults to now if omitted.",
    },
    validity_date: {
      label: "Valid Until / Expiration",
      type: "date",
      required: false,
    },
    pricelist_id: {
      label: "Pricelist",
      type: "many2one",
      relation: "product.pricelist",
      required: false,
      note: "Usually taken from the partner; only new lines use a changed pricelist.",
    },
    currency_id: {
      label: "Currency",
      type: "many2one",
      relation: "res.currency",
      required: false,
      note: "UI shows KES; follows pricelist/company if omitted.",
    },
    payment_term_id: {
      label: "Payment Terms",
      type: "many2one",
      relation: "account.payment.term",
      required: false,
      note: "UI default Immediate Payment comes from partner/company.",
    },
    warehouse_id: {
      label: "Warehouse",
      type: "many2one",
      relation: "stock.warehouse",
      required: true,
      note: "UI default TRINITY ENERGY — Odoo usually fills company default.",
    },
    source_location_id: {
      label: "Source Location",
      type: "many2one",
      relation: "stock.location",
      required: false,
      note: "UI default TRINITY/Stock; domain: internal locations of warehouse_id.",
    },
  },

  /**
   * Readonly / computed on the form — do NOT write on create.
   * Useful for portal status display after sync/read-back.
   */
  readonly: {
    is_immediate: {
      label: "Is Immediate Payment",
      type: "boolean",
      readonly: true,
    },
    customer_account_type: {
      label: "Customer Account Type",
      type: "selection",
      readonly: true,
      selection: {
        cash: "Cash Customer",
        credit: "Credit Customer",
        prepaid: "Prepaid Customer",
        hybrid: "Prepaid + Credit Customer",
      },
    },
    partner_credit_limit: {
      label: "Customer Credit Limit",
      type: "monetary",
      readonly: true,
    },
    partner_outstanding_balance: {
      label: "Customer Outstanding Balance",
      type: "monetary",
      readonly: true,
    },
    allowed_to_consume: {
      label: "Available Credit Balance",
      type: "monetary",
      readonly: true,
    },
    approval_status: {
      label: "Approval Status",
      type: "selection",
      readonly: true,
      widget: "badge",
      selection: {
        draft: "Draft",
        pending_hod: "Pending HOD Approval",
        hod_approved: "HOD Approved",
        cancelled: "Cancelled by HOD",
        order_booking: "Order Booking",
        hold: "On Hold – Credit/Stock Issue",
        pending_hod_marketing: "Pending CS Manager Approval",
        cs_review: "Returned to Customer Service",
        approved: "Approved – Transfer Sent to Depot",
        pending_hod_commercial: "Pending HOD Commercial Approval",
        commercial_approved: "HOD Commercial Approved",
        specialty_po_pending: "Purchase Order Pending Finance Approval",
        specialty_completed: "Specialty Order Completed",
        specialty_receipt_pending: "Pending Goods Receipt",
        rejected: "Rejected",
      },
    },
    approved_by: {
      label: "Approved By",
      type: "many2one",
      relation: "res.users",
      readonly: true,
    },
    approval_date: {
      label: "Approval Date",
      type: "datetime",
      readonly: true,
    },
  },
} as const;

export type SaleType = keyof typeof SALE_ORDER_QUOTATION_FIELDS.writable.sale_type.selection;
