export interface Subject {
  id: string;
  role?: string;
  [attribute: string]: unknown;
}

export interface Resource {
  ownerId?: string;
  [attribute: string]: unknown;
}

export type Action = string;

export type Env = Record<string, unknown>;

export type Condition = (user: Subject, resource: Resource, env: Env) => boolean;

export interface Rule {
  action: Action;
  name?: string;
  effect?: "allow" | "deny";
  condition: Condition;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

export class RuleSet {
  constructor(private readonly rules: Rule[]) {}

  private matches(rule: Rule, user: Subject, action: Action, resource: Resource, env: Env): boolean {
    return rule.action === action && rule.condition(user, resource, env);
  }

  private evaluate(user: Subject, action: Action, resource: Resource, env: Env): Decision {
    if (user.role === "admin") return { allowed: true, reason: "admin role bypass" };
    const denied = this.rules.find(
      (rule) => rule.effect === "deny" && this.matches(rule, user, action, resource, env)
    );
    if (denied) return { allowed: false, reason: `denied by rule: ${denied.name ?? "(unnamed)"}` };
    const matched = this.rules.find((rule) => this.matches(rule, user, action, resource, env));
    if (!matched) return { allowed: false, reason: "no matching rule" };
    return { allowed: true, reason: `matched rule: ${matched.name ?? "(unnamed)"}` };
  }

  can(user: Subject, action: Action, resource: Resource, env: Env = {}): boolean {
    return this.evaluate(user, action, resource, env).allowed;
  }

  explain(user: Subject, action: Action, resource: Resource, env: Env = {}): Decision {
    return this.evaluate(user, action, resource, env);
  }
}

export const defineRules = (rules: Rule[]): RuleSet => new RuleSet(rules);

const defaultRules = new RuleSet([
  { action: "read", condition: (user, resource) => resource.ownerId === user.id },
]);

export const can = (user: Subject, action: Action, resource: Resource): boolean =>
  defaultRules.can(user, action, resource);
