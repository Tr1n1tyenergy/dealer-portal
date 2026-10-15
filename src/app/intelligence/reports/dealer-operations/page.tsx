import { redirect } from "next/navigation";

/** Dealer orders moved to Retail Interface → Orders. */
export default function DealerOperationsPage() {
  redirect("/intelligence/retail/orders");
}
