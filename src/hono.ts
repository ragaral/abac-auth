import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { Env, RuleSet } from "./index.ts";

export interface AbacGuardConfig<TUser, TResource, TEnv extends Env = Env> {
  rules: RuleSet<TUser, TResource, TEnv>;
  /** L'acció ABAC que aquest guard protegeix (un guard per ruta/grup de rutes). */
  action: string;
  /** L'autenticació et pertany a tu: extreu el subjecte del context. */
  getUser: (c: Context) => TUser;
  getResource?: (c: Context) => TResource;
  getEnv?: (c: Context) => TEnv;
}

/**
 * Protegeix rutes Hono amb una decisió ABAC.
 * Denegació → 403 amb el motiu de `explain()` al body (auditabilitat gratis).
 */
export const abacGuard = <TUser, TResource, TEnv extends Env = Env>(
  config: AbacGuardConfig<TUser, TResource, TEnv>
) =>
  createMiddleware(async (c, next) => {
    const decision = config.rules.explain(
      config.getUser(c),
      config.action,
      config.getResource?.(c) ?? ({} as TResource),
      config.getEnv?.(c) ?? ({} as TEnv)
    );
    if (!decision.allowed) {
      return c.json({ error: "Forbidden", ...decision }, 403);
    }
    await next();
  });
