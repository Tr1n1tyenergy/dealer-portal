import { redirect } from "next/navigation";

/** TRI entry — open the Access Gateway first. */
export default function HomePage() {
  redirect("/access");
}
