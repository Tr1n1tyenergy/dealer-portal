import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitModules } from "./modules";

const staff = (role: string) => ({ accountType: "INTERNAL", role, permissions: null });
const ids = (role: string) => {
  const { work, admin } = splitModules(staff(role));
  return { work: work.map((m) => m.id), admin: admin.map((m) => m.id) };
};

describe("splitModules: the modules page shows each role its own panels", () => {
  it("gives an admin the three work modules and the admin tools", () => {
    assert.deepEqual(ids("SUPER_ADMIN"), {
      work: ["reports", "note-taker", "presentations"],
      admin: ["users", "activity", "settings"],
    });
  });

  it("gives a Sales Person Executive the work modules only", () => {
    assert.deepEqual(ids("SALES_PERSON_EXECUTIVE"), { work: ["reports", "note-taker", "presentations"], admin: [] });
  });

  it("gives a Standard user Note Taker and Presentations only", () => {
    assert.deepEqual(ids("STANDARD_USER"), { work: ["note-taker", "presentations"], admin: [] });
  });
});
