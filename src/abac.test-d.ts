import { describe, it, expectTypeOf } from "vitest";
import { defineRules } from "./abac.ts";

type User = { userId: string; dept: string };
type Doc = { docId: string; dept: string; secret: boolean };

const rules = defineRules<User, Doc>([
  { action: "read", name: "same-dept", condition: (user, doc) => user.dept === doc.dept },
]);

describe("client-defined types", () => {
  it("infers user and resource types on can()", () => {
    expectTypeOf(rules.can).parameter(0).toEqualTypeOf<User>();
    expectTypeOf(rules.can).parameter(2).toEqualTypeOf<Doc>();
  });

  it("infers types on condition callbacks", () => {
    expectTypeOf(rules.explain).parameter(0).toEqualTypeOf<User>();
    expectTypeOf(rules.explain).parameter(2).toEqualTypeOf<Doc>();
  });
});

type Ctx = { hour: number };

const ctxRules = defineRules<User, Doc, Ctx>([
  { action: "export", name: "office-hours", condition: (user, doc, env) => env.hour >= 8 },
]);

describe("client-defined env types", () => {
  it("infers env type on can() and explain()", () => {
    expectTypeOf(ctxRules.can).parameter(3).toEqualTypeOf<Ctx | undefined>();
    expectTypeOf(ctxRules.explain).parameter(3).toEqualTypeOf<Ctx | undefined>();
  });
});
