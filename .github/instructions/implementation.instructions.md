---
description: "Use when changing domain logic, hooks, services, types, or contexts. Covers layered architecture, DataManager flows, storage rules, and validation commands."
applyTo: "domain/**/*.ts,domain/**/*.tsx,hooks/**/*.ts,hooks/**/*.tsx,utils/**/*.ts,utils/**/*.tsx,types/**/*.ts,types/**/*.tsx,contexts/**/*.ts,contexts/**/*.tsx"
---

# Implementation Instructions

- Preserve the layered architecture: domain → services/DataManager → hooks → components.
- Keep `domain/*` pure: no React, no browser APIs, no file I/O, and no side effects.
- Route mutations through `DataManager` and existing services; do not write file-backed data directly from hooks, components, or contexts.
- Do not bypass `AutosaveFileService` or file storage notifications after successful writes.
- Use `error` as the caught exception variable name and prefer existing helpers such as `extractErrorMessage(error)` instead of new ad hoc error formatting.
- Prefer existing imports and aliases such as `@/domain` and `@/utils/*` over introducing parallel patterns.
- Validate implementation changes with `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build`.
