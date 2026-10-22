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

export class RuleSet<TUser = unknown, TResource = unknown, TEnv extends Env = Env> {
  constructor(private readonly rules: Rule<TUser, TResource, TEnv>[]) {}

  private matches(
    rule: Rule<TUser, TResource, TEnv>,
    user: TUser,
    action: Action,
    resource: TResource,
    env: TEnv
  ): boolean {
    const actionMatches =
      rule.action === "*" ||
      rule.action === action ||
      (rule.action.endsWith(":*") && action.startsWith(rule.action.slice(0, -1)));
    return actionMatches && rule.condition(user, resource, env);
  }

  private evaluate(user: TUser, action: Action, resource: TResource, env: TEnv): Decision {
    const denied = this.rules.find(
      (rule) => rule.effect === "deny" && this.matches(rule, user, action, resource, env)
    );
    if (denied) return { allowed: false, reason: `denied by rule: ${denied.name ?? "(unnamed)"}` };
    const matched = this.rules.find((rule) => this.matches(rule, user, action, resource, env));
    if (!matched) return { allowed: false, reason: "no matching rule" };
    return { allowed: true, reason: `matched rule: ${matched.name ?? "(unnamed)"}` };
  }

  can(user: TUser, action: Action, resource: TResource, env?: TEnv): boolean {
    return this.evaluate(user, action, resource, env ?? ({} as TEnv)).allowed;
  }

  explain(user: TUser, action: Action, resource: TResource, env?: TEnv): Decision {
    return this.evaluate(user, action, resource, env ?? ({} as TEnv));
  }
}

export const defineRules = <TUser, TResource, TEnv extends Env = Env>(
  rules: Rule<TUser, TResource, TEnv>[]
): RuleSet<TUser, TResource, TEnv> => new RuleSet(rules);
