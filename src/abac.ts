export type Action = string;

export type Env = Record<string, unknown>;

export type Condition<TUser, TResource, TEnv extends Env = Env> = (
  user: TUser,
  resource: TResource,
  env: TEnv
) => boolean;

export interface Rule<TUser = unknown, TResource = unknown, TEnv extends Env = Env> {
  action: Action;
  name?: string;
  effect?: "allow" | "deny";
  condition: Condition<TUser, TResource, TEnv>;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

export type Hierarchy = Record<Action, Action[]>;

export interface RuleSetOptions {
  hierarchy?: Hierarchy;
}

export class RuleSet<TUser = unknown, TResource = unknown, TEnv extends Env = Env> {
  private readonly implied: Map<Action, Set<Action>>;

  constructor(
    private readonly rules: Rule<TUser, TResource, TEnv>[],
    options: RuleSetOptions = {}
  ) {
    this.implied = computeImpliedActions(options.hierarchy ?? {});
  }

  private actionCovers(ruleAction: Action, requested: Action): boolean {
    if (ruleAction === "*") return true;
    if (ruleAction === requested) return true;
    if (ruleAction.endsWith(":*") && requested.startsWith(ruleAction.slice(0, -1))) return true;
    return this.implied.get(ruleAction)?.has(requested) ?? false;
  }

  private matches(
    rule: Rule<TUser, TResource, TEnv>,
    user: TUser,
    action: Action,
    resource: TResource,
    env: TEnv
  ): boolean {
    return this.actionCovers(rule.action, action) && rule.condition(user, resource, env);
  }

  /** El deny no hereta la jerarquia: retirar un permís no retira els que implica. */
  private matchesDeny(
    rule: Rule<TUser, TResource, TEnv>,
    user: TUser,
    action: Action,
    resource: TResource,
    env: TEnv
  ): boolean {
    const basicMatch =
      rule.action === "*" ||
      rule.action === action ||
      (rule.action.endsWith(":*") && action.startsWith(rule.action.slice(0, -1)));
    return basicMatch && rule.condition(user, resource, env);
  }

  private evaluate(user: TUser, action: Action, resource: TResource, env: TEnv): Decision {
    const denied = this.rules.find(
      (rule) => rule.effect === "deny" && this.matchesDeny(rule, user, action, resource, env)
    );
    if (denied) return { allowed: false, reason: `denied by rule: ${denied.name ?? "(unnamed)"}` };
    const matched = this.rules.find((rule) => this.matches(rule, user, action, resource, env));
    if (!matched) return { allowed: false, reason: "no matching rule" };
    const viaHierarchy =
      matched.action !== action && (this.implied.get(matched.action)?.has(action) ?? false)
        ? ` (${matched.action} implies ${action})`
        : "";
    return { allowed: true, reason: `matched rule: ${matched.name ?? "(unnamed)"}${viaHierarchy}` };
  }

  can(user: TUser, action: Action, resource: TResource, env?: TEnv): boolean {
    return this.evaluate(user, action, resource, env ?? ({} as TEnv)).allowed;
  }

  explain(user: TUser, action: Action, resource: TResource, env?: TEnv): Decision {
    return this.evaluate(user, action, resource, env ?? ({} as TEnv));
  }
}

export const defineRules = <TUser, TResource, TEnv extends Env = Env>(
  rules: Rule<TUser, TResource, TEnv>[],
  options: RuleSetOptions = {}
): RuleSet<TUser, TResource, TEnv> => new RuleSet(rules, options);

function computeImpliedActions(hierarchy: Hierarchy): Map<Action, Set<Action>> {
  const closure = new Map<Action, Set<Action>>();
  for (const [action, implied] of Object.entries(hierarchy)) {
    closure.set(action, new Set(implied));
  }

  // Iteració al punt fix: els conjunts només creixen i estan fitats per n²,
  // per la qual cosa termina. Un cicle a→b→a es tracta com a permisos equivalents.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [action, implied] of closure) {
      for (const next of [...implied]) {
        for (const transitive of closure.get(next) ?? []) {
          if (transitive !== action && !implied.has(transitive)) {
            implied.add(transitive);
            changed = true;
          }
        }
      }
    }
  }
  return closure;
}
