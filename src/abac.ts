export type Action = string;

export type Env = Record<string, unknown>;

export type Condition<TUser, TResource> = (user: TUser, resource: TResource, env: Env) => boolean;

export interface Rule<TUser = unknown, TResource = unknown> {
  action: Action;
  name?: string;
  effect?: "allow" | "deny";
  condition: Condition<TUser, TResource>;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

export class RuleSet<TUser = unknown, TResource = unknown> {
  constructor(private readonly rules: Rule<TUser, TResource>[]) {}

  private matches(rule: Rule<TUser, TResource>, user: TUser, action: Action, resource: TResource, env: Env): boolean {
    const actionMatches =
      rule.action === "*" ||
      rule.action === action ||
      (rule.action.endsWith(":*") && action.startsWith(rule.action.slice(0, -1)));
    return actionMatches && rule.condition(user, resource, env);
  }

  private evaluate(user: TUser, action: Action, resource: TResource, env: Env): Decision {
    const denied = this.rules.find(
      (rule) => rule.effect === "deny" && this.matches(rule, user, action, resource, env)
    );
    if (denied) return { allowed: false, reason: `denied by rule: ${denied.name ?? "(unnamed)"}` };
    const matched = this.rules.find((rule) => this.matches(rule, user, action, resource, env));
    if (!matched) return { allowed: false, reason: "no matching rule" };
    return { allowed: true, reason: `matched rule: ${matched.name ?? "(unnamed)"}` };
  }

  can(user: TUser, action: Action, resource: TResource, env: Env = {}): boolean {
    return this.evaluate(user, action, resource, env).allowed;
  }

  explain(user: TUser, action: Action, resource: TResource, env: Env = {}): Decision {
    return this.evaluate(user, action, resource, env);
  }
}

export const defineRules = <TUser, TResource>(
  rules: Rule<TUser, TResource>[]
): RuleSet<TUser, TResource> => new RuleSet(rules);
