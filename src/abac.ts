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

export type Condition = (user: Subject, resource: Resource) => boolean;

export interface Rule {
  action: Action;
  name?: string;
  condition: Condition;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

export class RuleSet {
  constructor(private readonly rules: Rule[]) {}

  private evaluate(user: Subject, action: Action, resource: Resource): Decision {
    if (user.role === "admin") return { allowed: true, reason: "admin role bypass" };
    const matched = this.rules.find(
      (rule) => rule.action === action && rule.condition(user, resource)
    );
    if (!matched) return { allowed: false, reason: "no matching rule" };
    return { allowed: true, reason: `matched rule: ${matched.name ?? "(unnamed)"}` };
  }

  can(user: Subject, action: Action, resource: Resource): boolean {
    return this.evaluate(user, action, resource).allowed;
  }

  explain(user: Subject, action: Action, resource: Resource): Decision {
    return this.evaluate(user, action, resource);
  }
}

export const defineRules = (rules: Rule[]): RuleSet => new RuleSet(rules);

const defaultRules = new RuleSet([
  { action: "read", condition: (user, resource) => resource.ownerId === user.id },
]);

export const can = (user: Subject, action: Action, resource: Resource): boolean =>
  defaultRules.can(user, action, resource);
