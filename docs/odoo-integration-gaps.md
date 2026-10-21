# Odoo integration — open questions

Moved from `INTEGRATION_GAPS` in `src/lib/integrations/odoo/quotation-contract.ts` (2026-10-21), which no code read.

- Source location trial mapping locked to PMS LOCAL quant External IDs per warehouse (ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS); confirm with Odoo ops that quant→location is the intended Stock location
- PMS/AGO products confirmed: PMSL001 + AGOL001 (see fuel-products.json externalIds)
- All portal stations have account.analytic.account External IDs (export 2026-10-15). Confirm with the Odoo admin which account is current for Malaa (6 or 146), Mariakani (3 or 147) and Outspan (5 or 151)
- Malaa and Mariakani are mapped in STATION_FULFILLMENT but not yet in official-dealers.json / dealer portal stations; confirm Mariakani loading warehouse (currently LAKE_OIL_NRB)
- Replace temporary EPRA retail prices with station-discounted dealer wholesale once Odoo pricelists are authoritative
- Lubricants + LPG product.product External IDs if orderable from portal
- Real dealer names + partner IDs for Kambiti, Dagoretti, Outspan placeholders
