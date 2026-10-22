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

Tota condició rep els tres pilars: **subjecte** (usuari), **recurs** i **entorn**. Els tres són **genèrics**: els tipus els defineixes tu i flueixen per tot el sistema.

```ts
const rules = defineRules<User, Doc, Ctx>([
  {
    action: "export",
    name: "only-in-office-hours",
    condition: (user, resource, env) => env.hour >= 8 && env.hour < 18,
    //                                ^ Ctx — tipat, sense anotacions repetides
  },
]);

rules.can(user, "export", doc, { hour: 10 }); // env opcional (default: {})
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

## Tipus definits pel client

El motor és **genèric** i no imposa cap forma: els tipus de `user` i `resource` són teus i flueixen per les condicions amb inferència completa.

```ts
type User = { userId: string; dept: string };
type Doc = { docId: string; dept: string; secret: boolean };

const rules = defineRules<User, Doc>([
  { action: "read", name: "same-dept", condition: (user, doc) => user.dept === doc.dept },
  //                                          ^ User?  ^ Doc — tipats automàticament
]);
```

També pots tipar l'**entorn** (`TEnv`) com a tercer paràmetre genèric: `defineRules<User, Doc, Ctx>`. Si les teves condicions depenen de props d'env obligatòries, passa sempre l'env a la crida — si l'ometes, la llibreria en passa un buit (comportament: les props falten → `undefined`).

## API completa

```ts
import { defineRules, RuleSet } from "abac-auth";

const rules = defineRules<User, Doc>([{ ... }]);   // sugar per a new RuleSet<User, Doc>([...])
rules.can(user, action, resource, env?)            // → boolean
rules.explain(user, action, resource, env?)        // → { allowed, reason }
```

## Desenvolupament

Metodologia **Red-Green-Refactor** estricta: un test nou → veure'l fallar → implementació mínima → verd → refactor.

```bash
npm test             # executar tests
npm run test:watch   # mode watch
npm run test:types   # type tests (expectTypeOf)
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
