import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { abacGuard } from "./hono.ts";
import { defineRules } from "./abac.ts";

const rules = defineRules([
  { action: "doc:edit", name: "owner-can-edit", condition: (u, r) => r.ownerId === u.id },
]);

const app = new Hono();
app.use(
  "/docs/*",
  abacGuard({
    rules,
    action: "doc:edit",
    getUser: (c) => ({ id: c.req.header("X-User-Id") ?? "" }),
    getResource: (c) => ({ ownerId: c.req.header("X-Doc-Owner") ?? "" }),
  })
);
app.get("/docs/:id", (c) => c.json({ ok: true, doc: c.req.param("id") }));

describe("abacGuard (Hono middleware)", () => {
  it("returns 403 with the decision reason when denied", async () => {
    const res = await app.request("/docs/1", {
      headers: { "X-User-Id": "u2", "X-Doc-Owner": "u1" },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("no matching rule");
  });
});

describe("abacGuard (allow path)", () => {
  it("passes to the handler with 200 when allowed", async () => {
    const res = await app.request("/docs/1", {
      headers: { "X-User-Id": "u1", "X-Doc-Owner": "u1" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, doc: "1" });
  });
});

describe("abacGuard (env context)", () => {
  const envRules = defineRules([
    {
      action: "doc:export",
      name: "office-hours-only",
      condition: (_u, _r, env: { hour: number }) => env.hour >= 8 && env.hour < 18,
    },
  ]);
  const envApp = new Hono();
  envApp.use(
    "/export",
    abacGuard({
      rules: envRules,
      action: "doc:export",
      getUser: (c) => ({ id: c.req.header("X-User-Id") ?? "" }),
      getEnv: (c) => ({ hour: Number(c.req.header("X-Hour") ?? 0) }),
    })
  );
  envApp.get("/export", (c) => c.json({ ok: true }));

  it("passes env from the request to the conditions", async () => {
    const allowed = await envApp.request("/export", { headers: { "X-Hour": "10" } });
    const denied = await envApp.request("/export", { headers: { "X-Hour": "23" } });

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
  });
});
