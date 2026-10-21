# abac-auth

Sistema d'autorització basat en atributs (ABAC) en TypeScript, dissenyat per ser reutilitzat en altres projectes.

## Ús

```ts
import { defineRules, can } from "abac-auth";

const rules = defineRules([
  { action: "approve", condition: (user, resource) => resource.status === "draft" },
  { action: "read", condition: (user, resource) => resource.ownerId === user.id },
]);

rules.can(user, "approve", doc); // → boolean
```

- Els usuaris amb `role: "admin"` tenen accés total.
- Les condicions són funcions purges `(subject, resource) => boolean`.

## Comandaments

```bash
npm test         # executar tests
npm run test:watch # tests en mode watch
npm run build    # compilar a dist/
```

## Desenvolupament

Seguim Red-Green-Refactor estrictament: un test nou → veure'l fallar → implementació mínima → verd → refactor.
