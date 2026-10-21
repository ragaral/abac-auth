import { describe, it, expect } from "vitest";
import { can, defineRules, RuleSet, type Resource, type Subject } from "./abac.ts";

describe("can", () => {
  it("allows the owner to read their own document", () => {
    const user = { id: "u1", role: "editor" };
    const doc = { id: "d1", ownerId: "u1", type: "document" };

    expect(can(user, "read", doc)).toBe(true);
  });

  it("denies reading a document owned by someone else", () => {
    const user = { id: "u2", role: "editor" };
    const doc = { id: "d1", ownerId: "u1", type: "document" };

    expect(can(user, "read", doc)).toBe(false);
  });

  it("allows an admin to do anything", () => {
    const admin = { id: "u9", role: "admin" };
    const doc = { id: "d1", ownerId: "u1", type: "document" };

    expect(can(admin, "delete", doc)).toBe(true);
  });
});

describe("defineRules (attribute-based rules)", () => {
  it("supports custom attribute conditions", () => {
    const rules = defineRules([
      {
        action: "approve",
        condition: (_user: Subject, resource: Resource) => resource.status === "draft",
      },
    ]);
    const doc = { id: "d1", ownerId: "u1", status: "draft" };
    const user = { id: "u1", role: "editor" };

    expect(rules.can(user, "approve", doc)).toBe(true);
    expect(rules.can(user, "approve", { ...doc, status: "published" })).toBe(false);
  });
});
describe("explain", () => {
  it("reports a denial with a reason when no rule matches", () => {
    const rules = new RuleSet([
      { action: "approve", condition: () => false },
    ]);
    const decision = rules.explain({ id: "u1" }, "read", { id: "d1" });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("no matching rule");
  });
});

describe("explain (matched rule)", () => {
  it("reports the name of the rule that granted access", () => {
    const rules = new RuleSet([
      { action: "read", name: "owner-can-read", condition: (_u, r) => r.ownerId === _u.id },
    ]);
    const decision = rules.explain({ id: "u1" }, "read", { id: "d1", ownerId: "u1" });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("matched rule: owner-can-read");
  });
});

describe("explain (admin bypass)", () => {
  it("explains that access was granted by the admin role", () => {
    const rules = new RuleSet([]);
    const decision = rules.explain({ id: "u9", role: "admin" }, "delete", { id: "d1" });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("admin role bypass");
  });
});

describe("deny rules (deny-overrides)", () => {
  it("denies when a matching deny rule wins over an allow rule", () => {
    const rules = new RuleSet([
      { action: "read", name: "owner-can-read", condition: (_u, r) => r.ownerId === _u.id },
      { action: "read", name: "banned-doc", effect: "deny", condition: (_u, r) => r.banned === true },
    ]);
    const user = { id: "u1" };
    const doc = { id: "d1", ownerId: "u1", banned: true };

    expect(rules.can(user, "read", doc)).toBe(false);
  });
});

describe("deny rules (explainability)", () => {
  it("explains which deny rule blocked the access", () => {
    const rules = new RuleSet([
      { action: "read", name: "banned-doc", effect: "deny", condition: () => true },
    ]);
    const decision = rules.explain({ id: "u1" }, "read", { id: "d1" });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("denied by rule: banned-doc");
  });
});
