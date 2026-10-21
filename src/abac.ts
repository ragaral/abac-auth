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
  condition: Condition;
}

export class RuleSet {
  constructor(private readonly rules: Rule[]) {}

  can(user: Subject, action: Action, resource: Resource): boolean {
    if (user.role === "admin") return true;
    return this.rules.some(
      (rule) => rule.action === action && rule.condition(user, resource)
    );
  }
}

export const defineRules = (rules: Rule[]): RuleSet => new RuleSet(rules);

const defaultRules = new RuleSet([
  { action: "read", condition: (user, resource) => resource.ownerId === user.id },
]);

export const can = (user: Subject, action: Action, resource: Resource): boolean =>
  defaultRules.can(user, action, resource);
