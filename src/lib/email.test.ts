import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invitationEmailHtml, passwordResetEmailHtml } from "./email";

describe("email HTML", () => {
  it("shows a first name as text, never as markup or a link", () => {
    const firstName = '<a href="https://evil.example">Click</a>';
    for (const html of [
      invitationEmailHtml({ firstName, activateUrl: "https://portal.example/activate?token=x" }),
      passwordResetEmailHtml({ firstName, resetUrl: "https://portal.example/reset?token=x" }),
    ]) {
      assert.ok(!html.includes("evil.example\">"), "no injected link");
      assert.ok(html.includes("&lt;a href=&quot;https://evil.example&quot;&gt;Click&lt;/a&gt;"));
    }
  });
});
