import Link from "next/link";
import { AuthLayout } from "@/components/access/auth-layout";

const options = [
  {
    href: "/dealer/login",
    title: "Dealer portal",
    description: "Fuel orders, PFIs and payments, order tracking.",
    image: "/assets2/img/access/dealer-station.jpg",
  },
  {
    href: "/intelligence/login",
    title: "Trinity staff",
    description: "Dealer orders, analytics, messages, meeting notes and presentations.",
    image: "/assets2/img/access/staff-office.jpg",
  },
  {
    href: "/depot/login",
    title: "Depot",
    description: "Loading, dispatch and deliveries.",
    image: "/assets2/img/access/depot-tanker.jpg",
  },
];

export default function AccessPage() {
  return (
    <AuthLayout headline="One platform, three portals." copy="Dealers, Trinity staff and depots, working on the same orders.">
      <h2 className="login-title">How are you signing in?</h2>
      <p className="login-copy">Choose your portal to continue to its sign-in page.</p>
      <nav className="access-list" aria-label="Portals">
        {options.map((option) => (
          <Link key={option.href} href={option.href} className="access-card">
            <span className="access-card__media" style={{ backgroundImage: `url("${option.image}")` }} aria-hidden />
            <span>
              <span className="access-card__title">{option.title}</span>
              <span className="access-card__desc">{option.description}</span>
            </span>
            <span className="access-card__go" aria-hidden>→</span>
          </Link>
        ))}
      </nav>
    </AuthLayout>
  );
}
