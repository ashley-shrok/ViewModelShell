---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 06
subsystem: markdown-pipeline / security
tags: [xss, sanitization, security-audit, markdown, both-backends, additive]
requires: [28-03]
provides:
  - Shipped whitelist-based URL scheme sanitizer at every markdown→InlineRun.href emission site on BOTH backends (TS + .NET)
  - Byte-parallel adversarial test coverage (19 + 19 tests) proving safety across regular links + autolinks × 4 dangerous schemes × case-mixing + whitespace bypasses
  - Byte-parity fix for the plain-collapse path so a sanitized href produces identical wire output on both backends
  - Audit note text for AGENTS.md (deferred to Plan 28-10 doc changes)
affects:
  - viewmodel-shell/src/markdown.ts (sanitizer + link emission site)
  - viewmodel-shell-dotnet/Markdown/MarkdownConverter.cs (sanitizer + regular link + autolink emission sites + collapse alignment)
  - viewmodel-shell/test/markdown-sanitization.test.ts (new)
  - viewmodel-shell-dotnet/Markdown/Tests/MarkdownSanitizationTests.cs (new)
tech-stack:
  patterns:
    - "Whitelist over blocklist (web-security orthodoxy — unknown schemes default to safe, not exploitable)"
    - "Sanitizer runs BEFORE opt-in linkHrefRewrite so consumer hook cannot re-introduce dangerous schemes"
    - "Byte-parallel .NET twin (identical scheme list, identical trim + case-fold semantics)"
key-files:
  modified:
    - viewmodel-shell/src/markdown.ts
    - viewmodel-shell-dotnet/Markdown/MarkdownConverter.cs
  created:
    - viewmodel-shell/test/markdown-sanitization.test.ts
    - viewmodel-shell-dotnet/Markdown/Tests/MarkdownSanitizationTests.cs
decisions:
  - "Disposition: CONSUMER-DEPENDENT (per Task 1 audit) — the existing linkHrefRewrite hook was opt-in, so every disallowed scheme reached InlineRun.href unfiltered by default. Shipped sanitizer is REQUIRED per fail-loud principle."
  - "Whitelist chosen over blocklist: allowed = http, https, mailto, tel, ftp + relative (no scheme). Everything else → empty string. Future scheme this framework doesn't know is refused, not passed."
  - "Sanitizer runs BEFORE linkHrefRewrite (not after): a consumer hook that naively echoes its input can never re-introduce a dangerous scheme accidentally."
  - "Autolink with sanitized href retains the RAW label as visible text (dead href, honest failure) rather than a silent empty span."
  - ".NET's BuildTextFromRuns plain-collapse aligned to treat empty Href as absent (matching TS), so both backends emit byte-identical wire (bare TextNode.Value, no runs[]) for a sanitized link."
metrics:
  duration_seconds: 429
  completed: 2026-08-01
---

# Phase 28 Plan 06: Q4 Markdown Sanitization Audit (READ side) Summary

Ship the D-Q4 sanitization audit on the display-side markdown → InlineRuns pipeline (both backends). Audit found that every dangerous URL scheme (`javascript:`, `data:`, `vbscript:`, `file:`) reached `InlineRun.href` unfiltered when a consumer had not passed the opt-in `linkHrefRewrite` hook — the exact stored-XSS surface Phase 28 exists to close. Ship a whitelist sanitizer at every href emission site on both backends, running BEFORE the opt-in hook, with byte-parallel test coverage.

---

## Audit Table (Task 1)

Empirical results from throw-away scripts run against the pre-sanitizer shipped code (deleted after audit).

| Input | TS backend href output (BEFORE) | .NET backend href output (BEFORE) | Disposition |
|-------|--------------------------------|-----------------------------------|-------------|
| `[click](javascript:alert(1))` | `"javascript:alert(1)"` | `"javascript:alert(1)"` | 🔴 GAP |
| `<javascript:alert(1)>` (autolink) | `"javascript:alert(1)"` | `"javascript:alert(1)"` | 🔴 GAP |
| `[click](data:text/html,<script>alert(1)</script>)` | `"data:text/html,<script>alert(1)</script>"` | `"data:text/html,<script>alert(1)</script>"` | 🔴 GAP |
| `[click](vbscript:msgbox)` | `"vbscript:msgbox"` | `"vbscript:msgbox"` | 🔴 GAP |
| `[click](file:///etc/passwd)` | `"file:///etc/passwd"` | `"file:///etc/passwd"` | 🔴 GAP |
| `[click](https://example.com/safe)` | `"https://example.com/safe"` | `"https://example.com/safe"` | ✅ SAFE (allowed) |
| `[click](/relative-safe)` | `"/relative-safe"` | `"/relative-safe"` | ✅ SAFE (allowed) |
| `[click](mailto:foo@bar.com)` | `"mailto:foo@bar.com"` | `"mailto:foo@bar.com"` | ✅ SAFE (allowed) |

**Overall Disposition: CONSUMER-DEPENDENT.** Both backends behaved identically — the `linkHrefRewrite` hook exists but is opt-in, and every dangerous scheme flowed through untouched by default. Per the plan's fail-loud principle ("framework never leaves an app one config mistake away from stored-XSS"), the shipped default sanitizer is REQUIRED.

Auto-fixed: none (nothing pre-existing needed fixing; the audit itself was investigative). Mitigation added per Task 2.

## Audit Table (AFTER mitigation, Task 2 + Task 3)

Empirical results after the shipped sanitizer landed, proven by the new adversarial tests.

| Input | TS backend disposition (AFTER) | .NET backend disposition (AFTER) |
|-------|-------------------------------|----------------------------------|
| `[click](javascript:alert(1))` | ✅ href absent (run collapsed to `TextNode.value = "click"`) | ✅ href absent (aligned collapse) |
| `<javascript:alert(1)>` (autolink) | ✅ href absent, label preserved as `"javascript:alert(1)"` | ✅ href absent, label preserved |
| `[click](data:text/html,<script>alert(1)</script>)` | ✅ href absent | ✅ href absent |
| `[click](vbscript:msgbox)` | ✅ href absent | ✅ href absent |
| `[click](file:///etc/passwd)` | ✅ href absent | ✅ href absent |
| `[click](https://example.com/safe)` | ✅ `"https://example.com/safe"` (preserved) | ✅ preserved |
| `[click](/relative-safe)` | ✅ `"/relative-safe"` (preserved) | ✅ preserved |
| `[click](mailto:foo@bar.com)` | ✅ `"mailto:foo@bar.com"` (preserved) | ✅ preserved |
| `[click](JAVASCRIPT:alert(1))` case-mix | ✅ href absent (case-insensitive) | ✅ href absent |
| `[click](  javascript:alert(1))` leading ws | ✅ href absent (trimmed before check) | ✅ href absent |
| `[click](wyciwyg:evil)` unknown scheme | ✅ href absent (whitelist default-safe) | ✅ href absent |

**Wire posture after sanitization:** A sanitized href produces a `TextNode` with `value` set to the raw label and NO `runs[]` (per gotcha #8, "an option not set is absent"). Both backends emit byte-identical output for this case — the .NET twin's plain-collapse was aligned to treat empty `Href` as absent to match TS (previously it was checking `Href is not null` which kept `""` runs alive).

---

## Mitigation Details (Task 2 + follow-up)

### TS: `viewmodel-shell/src/markdown.ts`

- **Added:** `ALLOWED_LINK_SCHEMES = ["http", "https", "mailto", "tel", "ftp"]` + `sanitizeHref(raw): string` helper.
- **Modified:** the link case in `convertInline` now routes `sanitizeHref(l.href)` BEFORE `linkHrefRewrite`.
- **Autolink fallback:** `autolinkText = href !== "" ? href : l.text` — visible text preserves the raw label so a sanitized autolink is honest (dead href, visible label) rather than a silent empty span.

### .NET: `viewmodel-shell-dotnet/Markdown/MarkdownConverter.cs`

- **Added:** `AllowedLinkSchemes` array + `SchemeRegex` (compiled) + `SanitizeHref(string): string` helper. Identical scheme list to TS; case-insensitive; trims before matching.
- **Modified:** the `LinkInline` case AND the `AutolinkInline` case each route through `SanitizeHref` before `LinkHrefRewrite`. Both emit the raw label as visible text on sanitized-empty href.
- **Byte-parity fix:** `BuildTextFromRuns` plain-collapse changed from `r.Href is not null` to `!string.IsNullOrEmpty(r.Href)` so the wire output for a sanitized link matches the TS twin exactly (bare `TextNode.Value`, no `runs[]`).

### Symmetry proof

Both backends' sanitizer regexes are identical (`^([a-zA-Z][a-zA-Z0-9+.\-]*):`), whitelist is byte-identical, comparison is `.toLowerCase()` / `.ToLowerInvariant()`, and both call `.trim()` / `.Trim()` first. The 19 sanitization tests on each side have parallel names and assertions; any future change on one side must be mirrored to keep both green.

---

## Test Coverage (Task 3)

### `viewmodel-shell/test/markdown-sanitization.test.ts` — **19 tests, all passing**

Adversarial (8): javascript regular + autolink + data + vbscript + file + unknown-scheme + case-mix + whitespace-bypass. Baseline positive (8): http, https, relative, fragment, mailto, tel, ftp, https-autolink. Composition (3): sanitizer-runs-before-hook, hook-still-transforms-allowed, autolink-fallback-preserves-label.

### `viewmodel-shell-dotnet/Markdown/Tests/MarkdownSanitizationTests.cs` — **19 tests, all passing**

Byte-parallel with the TS twin: same names, same input, same helper `ExpectHrefIsSafe` encoding the safety property "no run.Href names a scheme outside the whitelist".

### Regression check — 0 failures

- TS full markdown suites: 55/55 pass (36 pre-existing + 19 new)
- .NET Markdown Tests: 53/53 pass (34 pre-existing + 19 new)
- TS `check:test-types` (tsconfig.test.json coverage): 0 errors
- Parity gate: `bun run parity/run.ts` passes — wire unchanged, both backends still agree byte-for-byte on all fixtures

---

## Commits

| Commit | Message |
|--------|---------|
| `80cc083` | feat(28-06): ship shipped whitelist sanitizer for markdown link hrefs on both backends |
| `b1dac5e` | fix(28-06): align .NET plain-collapse with TS on empty Href (byte-parity for sanitized links) |
| `1672952` | test(28-06): adversarial + baseline sanitization tests on both backends (19 + 19 = 38 new tests) |

---

## AGENTS.md note text (for Plan 28-10 doc-changes to land)

> **Markdown link scheme sanitization (shipped default, Plan 28-06).** `viewmodel-shell/src/markdown.ts` and the `AshleyShrok.ViewModelShell.Markdown` NuGet twin both ship a WHITELIST-based URL scheme sanitizer at every href emission site (regular `[label](href)` links + `<scheme:...>` autolinks). Allowed: `http`, `https`, `mailto`, `tel`, `ftp` + no-scheme relative URLs. Everything else — including `javascript:`, `data:`, `vbscript:`, `file:`, and any scheme this framework hasn't heard of — produces an EMPTY href (`""`), which the plain-collapse path then absents entirely from the emitted `InlineRun` (matching gotcha #8's "an option not set is absent" posture). The sanitizer runs BEFORE the opt-in `linkHrefRewrite` / `LinkHrefRewrite` hook, so a consumer hook can never see a raw dangerous scheme regardless of how the consumer wrote its rewrite function. The two backends use IDENTICAL scheme lists (`http`, `https`, `mailto`, `tel`, `ftp`), trim before scheme extraction, and lowercase before whitelist lookup — any change on one side MUST be mirrored on the other, enforced by 19 byte-parallel tests on each side.
>
> Consumers who need to allow an additional scheme (e.g. a custom app-internal `myapp:` protocol) currently CANNOT — the whitelist is hard-coded. If that requirement materializes, the shape to add is a `MarkdownOptions.additionalAllowedSchemes: string[]` that extends the built-in list. Consumers who want the OPPOSITE (an even stricter whitelist) can implement it in their existing `linkHrefRewrite` hook — that hook receives the already-sanitized href, so a consumer wanting to reject `ftp:` too can do `linkHrefRewrite: h => h.startsWith("ftp:") ? "" : h`.

---

## Deviations from Plan

**One minor deviation** (Rule 3 — auto-fixed byte-parity issue):

**1. [Rule 3 - Blocking issue] .NET plain-collapse treated empty Href as present, breaking byte-parity with TS**
- **Found during:** Task 3 test authoring on .NET side
- **Issue:** `BuildTextFromRuns` was checking `r.Href is not null` for the "rich vs plain" collapse decision. After the sanitizer landed, a sanitized link's Href was `""` (not `null`) on .NET, so the run survived the collapse — while TS's `!r.href` check treated `""` as falsy and collapsed the run. Same wire input, different wire output.
- **Fix:** Changed the .NET check to `!string.IsNullOrEmpty(r.Href)` so both backends emit byte-identical wire (bare `TextNode.Value`, no `runs[]`) for a sanitized link. Documented at the collapse site.
- **Files modified:** `viewmodel-shell-dotnet/Markdown/MarkdownConverter.cs`
- **Commit:** `b1dac5e`

No architectural changes required. No auth gates. No skipped tasks.

---

## Threat Flags

None. The changes CLOSE a threat surface (T-28-16 in the plan's threat model — mitigation planned, mitigation delivered); they don't introduce new surface. Wire is unchanged; parity gate still green.

---

## Self-Check: PASSED

- ✅ Files created:
  - `viewmodel-shell/test/markdown-sanitization.test.ts` FOUND
  - `viewmodel-shell-dotnet/Markdown/Tests/MarkdownSanitizationTests.cs` FOUND
- ✅ Files modified (verified via `git diff` on commits):
  - `viewmodel-shell/src/markdown.ts` FOUND (sanitizer + emission site edit)
  - `viewmodel-shell-dotnet/Markdown/MarkdownConverter.cs` FOUND (sanitizer + 2 emission site edits + collapse alignment)
- ✅ Commits exist:
  - `80cc083` FOUND
  - `b1dac5e` FOUND
  - `1672952` FOUND
- ✅ Verification commands: TS 55/55, .NET 53/53, check:test-types clean, parity green
- ✅ Audit table (8 rows × 2 backends × before + after) present in this SUMMARY
- ✅ Sanitizer contract documented at both code sites AND in the AGENTS.md note above
