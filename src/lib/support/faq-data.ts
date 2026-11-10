export type FaqCategory = "Orders" | "PFIs" | "Payments" | "Technical" | "General";

export type FaqIconId =
  | "truck"
  | "document"
  | "card"
  | "download"
  | "alert"
  | "people"
  | "settings";

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  icon: FaqIconId;
  keywords: string[];
  order: number;
  published: boolean;
};

export const FAQ_CATEGORIES: { key: "ALL" | FaqCategory; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "Orders", label: "Orders" },
  { key: "PFIs", label: "PFIs" },
  { key: "Payments", label: "Payments" },
  { key: "Technical", label: "Technical" },
  { key: "General", label: "General" },
];

/**
 * Dealer Support FAQ content — grounded in current portal workflows.
 * Structured for future CMS migration without UI rewrite.
 */
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "place-order",
    order: 1,
    published: true,
    category: "Orders",
    icon: "truck",
    question: "How do I place a new fuel order?",
    keywords: ["order", "place", "fuel", "pms", "ago", "submit"],
    answer:
      "Open Place an Order from the dealer portal, choose your station, enter PMS and/or AGO volumes, set the requested delivery date, review the estimate, and submit. You can then track the order under My Orders.",
  },
  {
    id: "view-pfi",
    order: 2,
    published: true,
    category: "PFIs",
    icon: "document",
    question: "Where can I view my PFI details and payment status?",
    keywords: ["pfi", "pro forma", "invoice", "payment status", "documents"],
    answer:
      "Open My Orders or PFIs, then select the order. When a Pro Forma Invoice has been issued, you can view and download it from the order tracking page and see the current payment stage there.",
  },
  {
    id: "payment-methods",
    order: 3,
    published: true,
    category: "Payments",
    icon: "card",
    question: "What payment methods are available?",
    keywords: ["payment", "bank", "transfer", "pay pfi"],
    answer:
      "Payable orders are settled by bank transfer to Trinity’s listed accounts. Use Pay for this PFI on a payable order, transfer the exact amount shown, then submit your payment reference in the portal. Card payment is not available in the portal yet.",
  },
  {
    id: "download-docs",
    order: 4,
    published: true,
    category: "PFIs",
    icon: "download",
    question: "How do I download my invoices and delivery documents?",
    keywords: ["download", "invoice", "documents", "delivery note", "pfi"],
    answer:
      "Open the order under My Orders or PFIs. Available documents (such as the PFI) appear on the order tracking page once that stage is reached. Some delivery documents only become available after loading or dispatch.",
  },
  {
    id: "track-delivery",
    order: 5,
    published: true,
    category: "Orders",
    icon: "truck",
    question: "How can I track my delivery?",
    keywords: ["track", "delivery", "status", "dispatch", "transit"],
    answer:
      "Go to My Orders, open the order, and follow the tracking timeline from submission through depot, loading, dispatch, and delivery.",
  },
  {
    id: "order-issue",
    order: 6,
    published: true,
    category: "General",
    icon: "alert",
    question: "What should I do if I have an issue with my order?",
    keywords: ["issue", "problem", "ticket", "help", "support"],
    answer:
      "Raise a support ticket from the Support Centre. Choose the right department (Sales or Supply for most order issues), describe what happened, link the related order if possible, and attach screenshots or documents.",
  },
  {
    id: "contact-sales",
    order: 7,
    published: true,
    category: "General",
    icon: "people",
    question: "How do I contact the sales team?",
    keywords: ["sales", "contact", "phone", "email", "message"],
    answer:
      "Use Messages in the dealer portal to chat with the Trinity team, raise a Sales ticket in Support, or call/email the numbers listed under Contact Trinity.",
  },
  {
    id: "reset-password",
    order: 8,
    published: true,
    category: "Technical",
    icon: "settings",
    question: "How do I reset my password?",
    keywords: ["password", "reset", "login", "forgot", "access"],
    answer:
      "On the dealer login page, use Forgot Password with the email invited for your dealership. If you cannot complete the reset, raise an IT ticket from the Support Centre.",
  },
];

export function filterFaqs(params: {
  entries?: FaqEntry[];
  category: "ALL" | FaqCategory;
  query: string;
}): FaqEntry[] {
  const source = (params.entries ?? FAQ_ENTRIES)
    .filter((e) => e.published)
    .sort((a, b) => a.order - b.order);
  const needle = params.query.trim().toLowerCase();
  return source.filter((e) => {
    if (params.category !== "ALL" && e.category !== params.category) return false;
    if (!needle) return true;
    const hay = [e.question, e.answer, e.category, ...e.keywords].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}
