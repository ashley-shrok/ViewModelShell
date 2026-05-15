<!-- GSD:project-start source:PROJECT.md -->
## Project

**ViewModel Shell**

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser, and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree of typed nodes. A thin TypeScript adapter renders that tree to DOM with no app-specific code. Ships as two version-aligned packages: `@ashley-shrok/viewmodel-shell` (npm — frontend renderer + `/server` backend subpath) and `AshleyShrok.ViewModelShell` (NuGet — .NET backend types).

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end. If platform assumptions leak into the core, the framework's central promise (and its main differentiator) is broken.

### Constraints

- **Compatibility**: No wire-format or public-API breaking change. Consumers use bundlers (frontend) or the `/server` subpath (backend); the seam must be internal or backward-compatible.
- **Tech stack**: TypeScript ESM, compiled to `dist/` via tsc; npm + NuGet shipped version-aligned at major.minor for wire-format changes (npm-only bumps allowed for client-only changes).
- **Verification**: Phase is not done until the full parity suite is green AND the new CI invariant guard passes. Verifier/plan-check agents on — this is architecture-invariant work, not a quick.
- **Security**: Dual-use N/A; standard safe-code practices.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
