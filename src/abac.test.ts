import { describe, it, expect } from "vitest";
import { defineRules, RuleSet } from "./abac.ts";

describe("owner rule (client-defined)", () => {
  const rules = defineRules([
    {
      action: "read",
      condition: (u: { id: string }, r: { ownerId?: string }) => r.ownerId === u.id,
    },
  ]);

  it("allows the owner to read their own document", () => {
    const user = { id: "u1", role: "editor" };
    const doc = { id: "d1", ownerId: "u1", type: "document" };

    expect(rules.can(user, "read", doc)).toBe(true);
  });

  it("denies reading a document owned by someone else", () => {
    const user = { id: "u2", role: "editor" };
    const doc = { id: "d1", ownerId: "u1", type: "document" };

    expect(rules.can(user, "read", doc)).toBe(false);
  });

  it("denies actions with no default rule, even for admins — role is client-defined", () => {
    const admin = { id: "u9", role: "admin" };
    const doc = { id: "d1", ownerId: "u1", type: "document" };

    expect(rules.can(admin, "delete", doc)).toBe(false);
  });
});

describe("defineRules (attribute-based rules)", () => {
  it("supports custom attribute conditions", () => {
    const rules = defineRules([
      {
        action: "approve",
        condition: (_user, resource: { status: string }) => resource.status === "draft",
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

describe("explain (client-defined bypass)", () => {
  it("explains a client-defined admin bypass via wildcard rule", () => {
    const rules = new RuleSet([
      { action: "*", name: "admin-bypass", condition: (u) => u.role === "admin" },
    ]);
    const decision = rules.explain({ id: "u9", role: "admin" }, "delete", { id: "d1" });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("matched rule: admin-bypass");
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

describe("environment context", () => {
  it("passes env to conditions and denies when env does not match", () => {
    const rules = new RuleSet([
      {
        action: "export",
        name: "only-in-office-hours",
        condition: (_u, _r, env: { hour: number }) => env.hour >= 8 && env.hour < 18,
      },
    ]);
    const user = { id: "u1" };
    const resource = { id: "d1" };

    expect(rules.can(user, "export", resource, { hour: 10 })).toBe(true);
    expect(rules.can(user, "export", resource, { hour: 23 })).toBe(false);
  });
});

describe("action wildcards", () => {
  it("matches any action with the global * wildcard", () => {
    const rules = new RuleSet([
      { action: "*", name: "owner-full-control", condition: (_u, r) => r.ownerId === _u.id },
    ]);
    const owner = { id: "u1" };
    const doc = { id: "d1", ownerId: "u1" };

    expect(rules.can(owner, "read", doc)).toBe(true);
    expect(rules.can(owner, "delete", doc)).toBe(true);
  });
});

describe("action wildcards (prefix)", () => {
  it("matches namespaced actions with a prefix wildcard", () => {
    const rules = new RuleSet([
      { action: "doc:*", name: "owner-manages-docs", condition: (_u, r) => r.ownerId === _u.id },
    ]);
    const owner = { id: "u1" };
    const doc = { id: "d1", ownerId: "u1" };

    expect(rules.can(owner, "doc:edit", doc)).toBe(true);
    expect(rules.can(owner, "doc:share", doc)).toBe(true);
    expect(rules.can(owner, "user:delete", doc)).toBe(false); // altre namespace
  });
});

describe("role is client-defined", () => {
  it("gives admins no special power unless a rule grants it", () => {
    const rules = new RuleSet([]);
    const decision = rules.explain({ id: "u9", role: "admin" }, "delete", { id: "d1" });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("no matching rule");
  });
});
