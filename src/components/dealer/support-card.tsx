"use client";

import { useRouter } from "next/navigation";
import { PFI_COMPANY } from "@/lib/company/pfi-settings";
import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_SUBJECT,
  SUPPORT_HOURS,
  SUPPORT_LOCATION,
} from "@/lib/company/contact";

/** Contact details preserved from the old Support popup — used by Contact Trinity. */
export const SUPPORT_CONTACT = {
  email: SUPPORT_EMAIL,
  emailSubject: SUPPORT_EMAIL_SUBJECT,
  phones: PFI_COMPANY.phones,
  location: SUPPORT_LOCATION,
  hours: SUPPORT_HOURS,
} as const;

/**
 * Legacy helper: navigates to the Support Centre instead of opening the old modal.
 * Kept so older "Need help?" hooks still work if wired.
 */
export function openSupport() {
  if (typeof window === "undefined") return;
  window.location.assign("/dealer/support");
}

/** @deprecated Modal removed — Support is a full page at /dealer/support. */
export function SupportCard() {
  return null;
}

/** Client-side navigation helper for in-app CTAs. */
export function useOpenSupport() {
  const router = useRouter();
  return () => router.push("/dealer/support");
}
