import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeStaffNav, headerLinks, type HeaderGroup, type HeaderLink } from "./header-links";

const flat = (items: (HeaderLink | HeaderGroup)[]) =>
  items.map((i) => ("links" in i ? `${i.label}[${i.links.map((l) => `${l.label} ${l.href}`).join(", ")}]` : `${i.label} ${i.href}`));
const staff = (role: string, permissions = "[]") => ({ accountType: "INTERNAL", role, permissions });

describe("header menus", () => {
  it("dealer: Dashboard, Orders, PFIs, Messages, Support", () => {
    assert.deepEqual(flat(headerLinks("dealer")), [
      "Dashboard /dealer/dashboard",
      "Orders /dealer/orders",
      "PFIs /dealer/orders?view=documents",
      "Messages /dealer/messaging",
      "Support #support",
    ]);
  });

  it("staff Admin: every link plus the Admin group", () => {
    assert.deepEqual(flat(headerLinks("staff", staff("SUPER_ADMIN"))), [
      "Home /intelligence/dashboard",
      "Orders /intelligence/retail/orders",
      "Analytics /intelligence/retail",
      "Messages /intelligence/retail/messaging",
      "Users /intelligence/retail/users",
      "Admin[Admin users /intelligence/admin/users, Activity log /intelligence/admin/activity, Settings /intelligence/admin/settings]",
    ]);
  });

  it("Sales Person Executive: Home, Orders, Analytics, Messages only", () => {
    assert.deepEqual(flat(headerLinks("staff", staff("SALES_PERSON_EXECUTIVE"))), [
      "Home /intelligence/dashboard",
      "Orders /intelligence/retail/orders",
      "Analytics /intelligence/retail",
      "Messages /intelligence/retail/messaging",
    ]);
  });

  it("staff member with no permissions: only Home, no empty Admin group", () => {
    assert.deepEqual(flat(headerLinks("staff", staff("STANDARD_USER"))), ["Home /intelligence/dashboard"]);
  });

  it("staff member allowed only Admin users: Home and an Admin group with just that", () => {
    assert.deepEqual(flat(headerLinks("staff", staff("STANDARD_USER", '{"adminUsers.view":"allow"}'))), [
      "Home /intelligence/dashboard",
      "Admin[Admin users /intelligence/admin/users]",
    ]);
  });

  it("depot: Loading board", () => {
    assert.deepEqual(flat(headerLinks("depot")), ["Loading board /depot/dashboard"]);
  });

  it("underlines the right staff word for each page", () => {
    const cases: [string, string | null][] = [
      ["/intelligence/dashboard", "home"],
      ["/intelligence/retail", "analytics"],
      ["/intelligence/retail/orders", "orders"],
      ["/intelligence/retail/messaging", "messaging"],
      ["/intelligence/retail/users", "users"],
      ["/intelligence/admin/users", "admin-users"],
      ["/intelligence/admin/activity", "activity"],
      ["/intelligence/admin/settings", "settings"],
      ["/intelligence/elsewhere", null],
    ];
    for (const [path, key] of cases) assert.equal(activeStaffNav(path), key, path);
  });
});
