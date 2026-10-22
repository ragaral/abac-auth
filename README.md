# abac-auth

Sistema d'autorització basat en atributs (**ABAC**) en TypeScript, dissenyat per ser reutilitzat en altres projectes.

Zero dependències de runtime. Tipat estricte. ESM.

## Instal·lació

```bash
npm i github:ragaral/abac-auth
# o, si està publicat a un registry:
npm i abac-auth
```

## Ús ràpid

```ts
import { defineRules } from "abac-auth";

const rules = defineRules([
  { action: "doc:*", name: "owner-manages-docs", condition: (u, r) => r.ownerId === u.id },
  { action: "doc:publish", name: "no-publish-banned", effect: "deny", condition: (_u, r) => r.banned === true },
]);

const user = { id: "u1", role: "editor" };
const doc = { id: "d1", ownerId: "u1", banned: false };

rules.can(user, "doc:edit", doc); // → true
```

## Els 3 pilars ABAC

Tota condició rep els tres pilars: **subjecte** (usuari), **recurs** i **entorn**.

```ts
{
  action: "export",
  name: "only-in-office-hours",
  condition: (user, resource, env) => env.hour >= 8 && env.hour < 18,
}

rules.can(user, "export", doc, { hour: 10 }); // env és opcional (default: {})
```

## Regles

```ts
interface Rule {
  action: string;                // exacte, "*" (global) o "namespace:*" (prefix)
  name?: string;                 // identificador per a explain() i audit
  effect?: "allow" | "deny";     // default: "allow"
  condition: (user, resource, env) => boolean;
}
```

### Accions

| Patró | Coincideix amb |
|---|---|
| `"read"` | només `"read"` (exacte) |
| `"*"` | **qualsevol** acció |
| `"doc:*"` | `"doc:edit"`, `"doc:delete"`, ... (prefix de namespace) |

### Deny-overrides

Si **qualsevol** regla `effect: "deny"` coincideix, l'accés es denega sempre — fins i tot si altres regles allow també coincideixen, i fins i tot per a usuaris privilegiats. La primera deny que coincideix guanya. **Sense excepcions**.

### Els rols els defineix el client

El motor no té cap privilegi especial built-in. Un bypass d'admin és simplement una regla més:

```ts
{ action: "*", name: "admin-bypass", condition: (user) => user.role === "admin" }
```

Avantatge: semantics uniformes — `explain()` sempre respon "matched rule: admin-bypass", i una deny explícita pot lligar fins i tot l'admin si així ho vols.

## Explicabilitat

Cada decisió es pot explicar — clau per a auditoria i debugging:

```ts
rules.explain(user, "doc:edit", doc);
// → { allowed: true,  reason: "matched rule: owner-manages-docs" }
// → { allowed: false, reason: "denied by rule: no-publish-banned" }
// → { allowed: false, reason: "no matching rule" }
// → { allowed: true,  reason: "admin role bypass" }   (role: "admin")
```

`can()` és simplement `explain().allowed` — una sola font de veritat.

## API completa

```ts
import { defineRules, RuleSet, can } from "abac-auth";

const rules = defineRules([{ ... }]);      // sugar per a new RuleSet([...])
rules.can(user, action, resource, env?)    // → boolean
rules.explain(user, action, resource, env?) // → { allowed, reason }

can(user, "read", resource)                // helper standalone amb regles per defecte
                                           // (owner pot llegir recursos propis)
```

## Desenvolupament

Metodologia **Red-Green-Refactor** estricta: un test nou → veure'l fallar → implementació mínima → verd → refactor.

```bash
npm test             # executar tests
npm run test:watch   # mode watch
npm run build        # compilar a dist/ (amb correcció d'extensions als .d.ts)
```

- **TypeScript 7** amb `rewriteRelativeImportExtensions` (imports `.ts` al codi font)
- **Vitest** per als tests
- Publicat a: https://github.com/ragaral/abac-auth

## Roadmap

- [x] Regles d'atributs (subjecte, recurs)
- [x] Deny explícit (deny-overrides)
- [x] Explicabilitat de decisions
- [x] Context d'entorn
- [x] Wildcards d'acció (`*`, `ns:*`)
- [x] Rols definits pel client (cap privilegi built-in al motor)
- [ ] Helpers d'integració (middleware Hono/Express)
- [ ] Polítiques serialitzables (JSON)
- [ ] Jerarquia d'accions
