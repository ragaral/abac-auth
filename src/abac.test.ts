import { describe, it, expect } from "vitest";
import { can, defineRules, type Resource, type Subject } from "./abac.ts";

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
