/** Where dealers and staff write for help (login pages, the dealer Support card). */
export const SUPPORT_EMAIL = "support@trinityenergyltd.com";

/** Display label for Contact Trinity (summary — full street address lives on PFI company settings). */
export const SUPPORT_LOCATION = {
  label: "Trinity Energy – Operations",
  locality: "Nairobi, Kenya",
} as const;

/**
 * Dealer Support Centre hours (Africa/Nairobi).
 * Proposed UI copy aligned to the Contact Trinity mockup — confirm against ops before treating as SLAs.
 */
export const SUPPORT_HOURS = [
  { days: "Monday – Friday", hours: "8:00 AM – 5:30 PM" },
  { days: "Saturday", hours: "8:00 AM – 1:00 PM" },
  { days: "Sunday & Public Holidays", hours: "Closed" },
] as const;

export const SUPPORT_EMAIL_SUBJECT = "Trinity Retail Intelligence — Dealer Support Enquiry";
