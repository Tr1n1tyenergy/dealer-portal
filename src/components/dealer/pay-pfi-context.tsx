"use client";

import { createContext, useContext } from "react";
import type { PayPfiPanelProps } from "./pay-pfi-panel";

const PayPfiContext = createContext<PayPfiPanelProps | null>(null);

export function PayPfiProvider({
  value,
  children,
}: {
  value: PayPfiPanelProps | null;
  children: React.ReactNode;
}) {
  return <PayPfiContext.Provider value={value}>{children}</PayPfiContext.Provider>;
}

export function usePayPfi() {
  return useContext(PayPfiContext);
}
