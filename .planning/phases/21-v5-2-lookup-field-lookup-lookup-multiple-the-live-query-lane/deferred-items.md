# Phase 21 — deferred items (out of scope, discovered during execution)

## 21-01 — test files are not type-checked anywhere in `viewmodel-shell/`

**Found during:** Plan 21-01, Task 1 (declaring the lookup wire surface).

**The issue.** No test file in `viewmodel-shell/` is type-checked by any command:

- `tsconfig.json`'s `include` is `src/**/*.ts` and it explicitly excludes `src/**/*.test.ts`;
  `test/**` is outside `include` entirely.
- `vitest` transpiles via esbuild and does not type-check.

⇒ `npx tsc --noEmit` and `npx vitest run` — the two commands the green-tree gate leans on — **both**
pass on a test file containing type errors. Observed concretely in 21-01: a new type-level suite
passed under vitest while the type it imported (`LookupItem`) did not yet exist.

**Why it matters.** A `@ts-expect-error` that is never type-checked *looks* like a guard and is not
one — it silently passes whether or not the error it claims to pin actually occurs. Any suite that
asserts a type-level contract (this repo has a real interest in those: `T | T[]` parity drift,
optional-vs-required wire fields) is currently unenforced.

**Not fixed here because** it is repo-wide, predates Phase 21, and is outside 21-01's scope (TS types +
the TS validator). Fixing it touches the build/CI config for every suite.

**Suggested fix.** A `tsconfig.test.json` (extending the root, `include: ["src/**/*", "test/**/*"]`,
`noEmit`) plus a `check:types-tests` npm script, wired into `.github/workflows/parity.yml` alongside
`check:core-globals`. Then delete the per-file explicit-tsc workaround documented in
`test/lookup-wire-shape.test.ts`'s header.

**Interim mitigation (in place):** `test/lookup-wire-shape.test.ts` documents and is verified by an
explicit tsc invocation in its header comment.
