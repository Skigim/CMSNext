# Custom Agents

This directory contains focused custom agent definitions for delegating bounded work to Copilot subagents. The `triage` agent acts as the CMSNext manager and routes work to the right specialist through explicit handoffs in VS Code chat. Reference material and reusable workflows still live under `.github/skills/`, repo-local Superpowers skills are vendored under `skills/`, and repo guidance or customization-registry ownership can route through the dedicated `documentation` agent.

## Usage

When dispatching a subagent, reference the relevant agent definition for the target domain.

```
"Read the `storage` agent definition for context, then [task description]..."
```

The default workspace agent is also instructed through `.github/copilot-instructions.md` to delegate automatically when a task clearly matches one of these domains. Start with `triage` when a task is ambiguous, multi-stage, or needs a visible handoff path in VS Code chat. `Explore` is a built-in read-only discovery agent, not a repository-defined agent in this folder.

## Superpowers Overlay

When the active harness exposes installed Superpowers skills, use them as a process overlay on top of these CMSNext agents rather than as a replacement for them.

- Start with `skills/using-superpowers/SKILL.md`, then immediately load `repo-memories`, then check whether a relevant Superpowers skill applies before any other action.
- If a relevant Superpowers skill is available, load and invoke it rather than treating the check as optional.
- This is mandatory for every CMSNext task, including read-only investigation, planning, delegation, implementation, review, and closeout.
- No thought, rationalization, clarifying question, or exploratory action should occur until `skills/using-superpowers/SKILL.md`, `repo-memories`, and the current skill-selection decision are complete.
- When workspace hooks are enabled, record startup completion with `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` before any non-startup tool use.
- `triage` should bias toward `brainstorming`, `writing-plans`, and related planning skills for ambiguous or multi-stage work.
- Implementation specialists should bias toward `test-driven-development`, `systematic-debugging`, `requesting-code-review`, and `verification-before-completion` as the work moves from diagnosis to implementation to closeout.
- `documentation` should keep repo instructions, registry text, and discovery guidance aligned when workflow or skill expectations change.

This keeps skill selection process-oriented while the repo agents stay responsibility-oriented.

## Available Agents

| Agent           | Domain                     | Use For                                                                                  |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `triage`        | Workflow manager           | Responsibility-first investigation, subsystem identification, and handoff orchestration  |
| `documentation` | Documentation and guidance | README files, guides, agent customizations, registry docs, and workflow/process guidance |
| `frontend`      | Frontend and UI            | Components, app-shell flows, styling, accessibility, and visual behavior                 |
| `domain`        | Domain logic               | Pure business rules, validation, calculations, and transformations                       |
| `services`      | Services and DataManager   | Use-case orchestration, workflow sequencing, and read-modify-write flows                 |
| `testing`       | Testing                    | Cross-layer testing, regressions, accessibility coverage, and test failures              |
| `storage`       | Storage layer              | File System Access API, autosave, serialization, and persistence mechanics               |
| `hooks`         | Custom hooks               | State management, service integration                                                    |
| `audit`         | Quality                    | Security, accessibility, performance, and architecture audits                            |
| `Explore`       | Built-in discovery         | Broad read-only discovery when the right files or code paths are not yet clear           |

## Ownership Matrix

| Responsibility                                                                                           | Primary owner                                               | Notes                                                                        |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Business rules, validation, transformations                                                              | `domain`                                                    | Pure logic only; no React or persistence                                     |
| Application orchestration and use-case sequencing                                                        | `services`                                                  | `DataManager` and services coordinate workflows                              |
| Persistence implementation and file lifecycle                                                            | `storage`                                                   | File System Access API, autosave, serialization, disk reads/writes           |
| React workflow state and coordination                                                                    | `hooks`                                                     | Local UI state and React-side orchestration                                  |
| Rendering, interaction, and visual behavior                                                              | `frontend`                                                  | Components, accessibility-sensitive UI, styling                              |
| Documentation, workflow guidance, and customization registry updates                                     | `documentation`                                             | Guides, README files, `.github/`, `docs/`, and agent or instruction metadata |
| Minimal direct tests for owned changes                                                                   | Specialist agent                                            | Each specialist updates the narrow tests for its own change                  |
| Cross-layer integration, regression, accessibility test strategy, shared test infra, flaky/failing tests | `testing`                                                   | Owns test-heavy work that crosses feature or layer boundaries                |
| Cross-cutting logging, telemetry, performance, and error handling                                        | Layer owner (`storage` / `services` / `hooks` / `frontend`) | Route by implementation responsibility; `audit` verifies                     |
| Routing ambiguous or multi-stage requests                                                                | `triage`                                                    | Choose a primary owner by responsibility first and keep handoffs explicit    |

## Handoff Workflow

Use `triage` as the manager when the task needs discovery, routing, or stage changes. Typical flow:

1. `triage` investigates and picks the primary owner.
2. A specialist agent implements or reviews the targeted layer or documentation surface.
3. `testing` adds or verifies broader regression coverage when needed.
4. `audit` reviews risk, regressions, accessibility, performance, or architecture compliance.
5. `documentation` closes out the task when repo guidance, registry metadata, or customization docs need to be synchronized with the delivered change.
6. Specialists hand back to `triage` when the next step is no longer obvious.

When an `audit` result is mostly about missing regression coverage, accessibility validation, or unverified browser behavior rather than a confirmed implementation bug, hand off to `testing` first. Return to `frontend` only if targeted tests or required manual Chromium verification confirm a real UI defect.

## Related Skills

| Skill            | Purpose                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| Repo memories    | Concentrated repository conventions and reminders                            |
| Agent delegation | Choosing the right customization primitive and drafting delegation prompts   |
| Superpowers      | Optional workflow overlay for planning, debugging, TDD, review, and closeout |

## Consolidated Guides

For major development areas, see the consolidated guides in the `.github` folder:

| Guide                | Focus                                 |
| -------------------- | ------------------------------------- |
| Implementation guide | Services, domain, hooks, data flow    |
| UI guide             | React components, shadcn/ui, Tailwind |
| Testing guide        | Vitest, RTL, mocking patterns         |

## Quick Reference

### Project Architecture

```
DataManager (orchestrator)
├── FileStorageService    # File I/O
├── CaseService           # Case CRUD
├── FinancialsService     # Financial items
├── NotesService          # Notes
├── ActivityLogService    # Activity logging
├── CategoryConfigService # Status config
└── AlertsService         # Alerts
```

### Tech Stack

- **Framework:** React 18 + TypeScript (strict mode)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Testing:** Vitest + React Testing Library + jest-axe
- **Storage:** File System Access API (local-first, no network)

### Core Principles

1. **Services are stateless** - Dependencies via constructor injection
2. **File system is truth** - No caching, always read fresh
3. **Components are UI only** - Business logic in services
4. **Hooks bridge the gap** - Connect services to React state
5. **Scope stays bounded** - Specialists avoid cross-boundary expansion unless the task explicitly requires it
