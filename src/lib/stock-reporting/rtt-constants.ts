/** Shared RTT limits — safe for client + server imports (no Node/Prisma). */
export const RTT_REASON_MAX_CHARS = 250;
/** Under Vercel's 4.5 MB request body limit. */
export const RTT_JOB_CARD_MAX_BYTES = 4 * 1024 * 1024;
