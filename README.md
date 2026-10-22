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

## Recursos múltiples

Un `RuleSet` és homogeni en els seus paràmetres de tipus, però això **no et limita**: les condicions reben sempre el mateix valor de recurs, així que totes les regles han de parlar del mateix tipus. Hi ha dos patrons per treballar amb varis tipus de recurs:

### Patró 1: tipus unió — un sol guard per a molts tipus

Els paràmetres genèrics poden ser unions. Les regles sobre camps compartits no necessiten narrowing; les específiques, sí:

```ts
const mixed = defineRules<User, Doc | Invoice>([
  { action: "*", condition: (u, r) => r.ownerId === u.id },  // camp compartit: directa
  { action: "read", effect: "deny",
    condition: (_u, r) => r.kind === "doc" && r.secret },     // narrowing per Doc
  { action: "read", effect: "deny",
    condition: (_u, r) => r.kind === "invoice" && r.amount > 1000 }, // narrowing per Invoice
]);

mixed.can(user, "read", doc);     // ✓ tipat
mixed.can(user, "read", invoice); // ✓ tipat
```

### Patró 2: regles comunes reutilitzades entre sets

Les regles definides sobre un tipus **base** són assignables a qualsevol set amb tipus més **estret** (contravariància de les condicions):

```ts
type Base = { ownerId: string };

const commonRules: Rule<User, Base>[] = [
  { action: "*", condition: (u, r) => r.ownerId === u.id },
];

const docRules = new RuleSet<User, Doc>([
  ...commonRules,
  { action: "doc:edit", condition: (_u, r) => !r.secret },
]);

const invRules = new RuleSet<User, Invoice>([
  ...commonRules,
  { action: "invoice:pay", condition: (_u, r) => r.amount < 5000 },
]);
```

> **Nota**: cada regla no pot tenir tipus totalment independents dins d'un mateix set — la crida `can(user, action, resource)` passa **un** recurs, així que totes les condicions han de ser compatibles amb aquell valor. Si necessites dispatch per tipus de subjecte (estil CASL), ho has de modelar amb unions o sets separats.

### Jerarquia d'accions

Si un permís **implica** un altre (editar implica llegir), declara-ho amb l'opció `hierarchy` — la clòsure transitiva es calcula a la construcció:

```ts
const rules = defineRules([
  { action: "doc:edit", name: "editor", condition: (u, r) => r.ownerId === u.id },
], {
  hierarchy: {
    "doc:edit": ["doc:read"],
    "doc:delete": ["doc:read"],
    "doc:admin": ["doc:edit"],  // transitivament: admin → edit → read
  },
});

rules.can(user, "doc:read", doc); // true: la regla d'edit cobreix read
```

**Semàntica asimètrica (intencionada)**: la jerarquia només s'aplica als **allow** — concedir un permís et concedeix els que implica. Les **deny** no l'hereten: retirar el permís d'editar **no retira** el de llegir. Els wildcards, en canvi, funcionen a banda i banda (són expansió de conjunt, no implicació).

L'`explain()` ho fa visible: `"matched rule: editor (doc:edit implies doc:read)"`.

**Cicles**: si declares un cicle (`a → b → a`), no és un error — significa que `a` i `b` són permisos equivalents. La clòsure es calcula per iteració al punt fix (terminació garantida, independent de l'ordre de declaració), i el resultat és correcte també quan hi ha nodes externs que apunten dins el cicle.

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
- [x] Jerarquia d'accions (clòsure transitiva, deny no hereta)
- [ ] Helpers d'integració (middleware Hono/Express)
- [ ] Polítiques serialitzables (JSON)

