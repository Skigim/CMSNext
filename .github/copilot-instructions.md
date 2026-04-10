## General Approach

- Start every CMSNext task by loading `skills/using-superpowers/SKILL.md` before any reasoning, rationalization, repo exploration, delegation, review, or implementation work, even for small tasks.
- Immediately after `skills/using-superpowers/SKILL.md`, load the `repo-memories` skill/reference before any repo-specific reasoning or action.
- For every action, check for existing patterns and documentation first — do not invent new solutions until certain one does not already exist.
- Prioritize clarity and maintainability over cleverness.
- Break complex work into logical steps; track via todo lists.
- Surface blockers immediately rather than proceeding with incomplete information.
- Run full test suite and build after significant changes; fix before committing.

## Environment and Validation

### Startup Checklist

Before making changes, establish the repo environment using this sequence:

1. Read `README.md` for product, architecture, and command overview.
2. Read `.github/implementation-guide.md`, `.github/ui-guide.md`, and `.github/testing-guide.md` before introducing new patterns.
3. Use `npm` for all package management and script execution.
4. Install dependencies with `npm ci` when lockfile fidelity matters; otherwise use `npm install` only if necessary.
5. Prefer existing scripts over ad hoc shell commands.

### Standard Validation Commands

For meaningful code changes, run the full verification flow:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Treat failures in any step as blockers before considering the work complete.

### Runtime Assumptions

- This is a local-first React + TypeScript + Vite application.
- There is no backend, no remote API, and no cloud sync layer.
- Primary persistence depends on the File System Access API.
- Browser-specific flows should assume a supported Chromium-based environment for full functionality.
- Unsupported browsers should receive compatibility handling, not fake fallback behavior.

### Implementation Constraints for Agents

- Do not introduce backend, authentication, database, repository, cache, or event-bus patterns.
- Route mutations through `DataManager` and existing services.
- Keep domain logic pure and free of React or I/O dependencies.
- Do not bypass `AutosaveFileService` or file storage notifications.
- Preserve provider ordering and context contracts.

### Testing Expectations

- Add or update tests when changing business logic, hooks, services, or UI behavior.
- Use existing Vitest and React Testing Library patterns already documented in `.github/testing-guide.md`.
- Include accessibility coverage for new interactive UI where applicable.
- Do not consider a task done if tests or build are failing.

### Agent Workflow Preference

When starting a task, prefer this order:

1. Load `skills/using-superpowers/SKILL.md` first.
2. Load `repo-memories` immediately after `skills/using-superpowers/SKILL.md`.
3. Load `skill-governance` immediately after `repo-memories` to choose the skill coverage for the next action.
4. Load any more specific applicable skill selected by `skill-governance` before taking that action.
5. When workspace hooks are enabled, run `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` immediately after `repo-memories`, `skill-governance`, and any required Superpowers skill.
6. Inspect existing docs and patterns.
7. Find the nearest existing implementation.
8. Make the smallest coherent change.
9. Validate with the standard command sequence.
10. Update documentation or repository memory when behavior, workflow, or durable conventions meaningfully change.

### Superpowers Skill Overlay

- CMSNext vendors the upstream Superpowers skill library under `skills/` in this repository.
- CMSNext keeps that vendored tree because plugin-based Superpowers discovery has been unreliable in practice; the repository relies on direct repo-local skill paths as the deterministic fallback.
- The vendored `skills/` tree is intentionally used by repo instructions and startup hooks, while `.github/skills/` remains the native workspace-discoverable location for CMSNext-owned skills.
- `skills/using-superpowers/SKILL.md` is the mandatory first skill reference for every CMSNext task.
- The centralized skill-selection workflow lives in `.github/skills/skill-governance/SKILL.md`.
- CMSNext assumes the Obra Superpowers plugin is installed and available for advanced workflow skills.
- Treat the plugin as a preferred overlay when it is working correctly, not as the only reliable way to access required Superpowers workflow guidance in this repository.
- After loading `skills/using-superpowers/SKILL.md`, the agent must load `repo-memories` before any repo-specific thought or action.
- After loading `repo-memories`, the agent must load `skill-governance` before taking any non-startup action.
- If `skill-governance` selects a more specific applicable skill, the agent must load and invoke it for that action rather than merely noting that it exists.
- This requirement is unconditional for CMSNext work and applies to read-only exploration, clarifying questions, delegation, planning, implementation, review, and closeout.
- No thought, rationalization, clarifying question, exploration, delegation, or implementation action should occur until `skills/using-superpowers/SKILL.md`, `repo-memories`, and the current `skill-governance` decision are complete.
- Every distinct action or tool batch must be grounded in at least one loaded skill. `repo-memories` is the baseline skill for all CMSNext work, and `skill-governance` determines whether that baseline is sufficient for the current action.
- Before each new phase of work, re-run the `skill-governance` decision instead of assuming earlier skill coverage still applies.
- If no more specific Superpowers skill exists for the current action, explicitly proceed under `repo-memories` rather than treating the action as skill-free.
- If an expected Obra Superpowers skill is missing, treat that as an environment problem rather than silently bypassing the workflow.
- When the workspace startup guard hook is enabled, the agent must record completion of this startup sequence by running `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` before any non-startup tool use.
- Treat Superpowers as a workflow overlay, not a replacement for direct user instructions, repo instructions, or CMSNext's responsibility-first routing rules.
- Prefer Obra Superpowers planning and collaboration skills such as `brainstorming`, `writing-plans`, and `subagent-driven-development` for ambiguous, multi-stage, or implementation-heavy work.
- Prefer Obra Superpowers `systematic-debugging` for bug investigation, `test-driven-development` for behavior-changing implementation work, `requesting-code-review` for completed implementation chunks, and `verification-before-completion` before closing out substantial tasks.

### Automatic Agent Delegation

- Use the default workspace agent as the primary conversational and orchestration surface for discussing CMSNext work in plain English, gathering context, and deciding when delegation is actually needed.
- Do not route to `triage` by default just because a task is ambiguous or multi-stage; keep the user in the main conversation unless context isolation or a structured handoff artifact would materially help.
- Use `triage` as a subagent when the task specifically benefits from responsibility-first problem framing, ownership mapping, stage planning, or a handoff-ready prompt for another specialist.
- The default agent should delegate automatically when a task clearly matches one of the workspace custom agents.
- Route ambiguous tasks by **responsibility and architectural ownership first**, then use file proximity as a tiebreaker.
- Delegate to `audit` for code reviews, security analysis, accessibility checks, performance investigations, regression hunting, release readiness, or architecture compliance checks.
- Keep `audit` in a verifier role for cross-cutting concerns rather than the default implementation owner.
- Delegate to `documentation` for README updates, development guides, roadmap/process docs, repo instructions, agent customization files, registry fixes, and workflow or discovery guidance.
- Specialist agents should add or update the **minimal direct tests** for the code they change. Delegate to `testing` for cross-layer integration work, accessibility-focused testing work, regression coverage, shared test utilities or mocks, and flaky or failing test investigation.
- Delegate to `services` for DataManager changes, service orchestration, application use-case sequencing, activity logging, and read-modify-write flows that do not change persistence mechanics.
- Delegate to `domain` for pure business logic, calculations, validation, transformations, formatting helpers, or extracting logic into `domain/*` modules.
- Delegate to `frontend` for component implementation, UI refactors, interaction design, accessibility-sensitive component work, styling, layout, or app-shell behavior.
- Delegate to `hooks` for custom hook design, hook refactors, React state orchestration, effect bugs, callback stability issues, or extracting logic from components into hooks.
- Delegate to `storage` for File System Access API work, file handle flows, autosave behavior, serialization and deserialization, disk read/write mechanics, file lifecycle on disk, persistence bugs, storage migrations, storage diagnostics, or local-first data integrity concerns.
- Route app-wide logging, telemetry, performance instrumentation, and error handling to the agent that owns the layer implementing the change: `storage` for persistence-path concerns, `services` for orchestration and workflow concerns, `hooks` for React workflow-state coordination, and `frontend` for UI rendering and interaction concerns. Use `audit` to verify compliance, not as the default implementer.
- Delegate to `Explore` for broad read-only discovery when the right files, patterns, or code paths are not yet clear.
- Use `triage` only when you want a bounded subagent pass that returns a responsibility-focused problem statement, recommended owner, risks, and a clean handoff prompt.
- If a task spans multiple areas, choose one **primary owner** based on responsibility, then involve a secondary agent only when the task explicitly requires a cross-boundary change.
- Specialist agents should avoid expanding beyond their owned boundary unless the task explicitly requires cross-boundary edits.
- Keep work in the default agent when the task is narrow, the affected files are already obvious, and context isolation would add overhead without improving outcome quality.
- When delegating, include the goal, relevant files or feature area, whether the agent should remain read-only or edit files, and the expected return format.

### Instruction Hierarchy

- Treat this file as the repository-wide baseline for all tasks.
- When a task touches files matched by `.github/instructions/*.instructions.md`, follow those scoped instructions in addition to this file.
- Prefer the scoped instruction file that is closest to the kind of work you are doing (implementation, frontend, or tests) before searching more broadly.

## Architecture

The application follows a layered, local-first architecture designed to keep business logic pure, storage concerns isolated, and React code focused on UI and state orchestration.

### Data Layer

- **Coordinator:** `DataManager` is the central entry point for all data mutations and read flows.
- **Services:** Stateless services live under `utils/services/*` (e.g., `CaseService`, `FinancialsService`, `NotesService`, `AlertsService`, `CategoryConfigService`, `ActivityLogService`, `FileStorageService`).
- **File as source of truth:** The file on disk is the single source of truth; do not introduce in-memory caches or repository/event-bus layers.
- **Mutation rule:** All writes must go through `DataManager`, which in turn delegates to services. Do not mutate file data directly from hooks or components.
- **Dependencies:** Services receive their dependencies via constructor injection; they remain stateless and side-effectful only through their collaborators.

### Domain Layer

- **Purity:** Domain modules contain pure, side-effect-free functions only—no React, no I/O, no direct access to browser APIs.
- **Structure:** Organized by feature under `domain/*` (e.g., `alerts`, `avs`, `cases`, `common`, `dashboard`, `financials`, `templates`, `validation`).
- **Imports:** Prefer `@/domain` or `@/domain/{module}` imports from hooks and services; do not import domain code directly into React components.
- **Responsibility:** Domain functions perform calculations, formatting, validation, and transformation. They should be trivial to unit-test in isolation.

### Storage Layer

- **Flow:** `FileStorageContext` (handles + permissions) → `AutosaveFileService` → File System Access API.
- **API guard:** Always check `fileDataProvider.getAPI()` (or equivalent helper) before accessing the File System Access API; treat `null` as unsupported.
- **Autosave:** Do not bypass `AutosaveFileService` for file writes. It manages debounced saves (≈5s normally, ≈15s for bulk operations) and consistency guarantees.
- **Notifications:** After successful writes, call the appropriate `safeNotifyFileStorageChange()` helper to inform the rest of the app about data changes.
- **Assumptions:** There is no backend, no remote sync, and no auth layer. Access is permission-based and local-first.

### Data Format (v2.2 Normalized)

- The current file format is a **flat, normalized** structure:
  - `version: "2.2"`
  - `people: Person[]`
  - `cases: StoredCase[]`
  - `financials: Financial[]` (FK: `caseId`)
  - `notes: Note[]` (FK: `caseId`)
  - `alerts: Alert[]` (FK: `caseId`)
  - `exported_at: string`
  - `total_cases: number`
  - `categoryConfig: CategoryConfig`
  - `activityLog: ActivityLogEntry[]`
  - `templates?: Template[]`
- Avoid introducing nested or denormalized structures; new fields should extend existing records, not embed cross-cutting data.
- Persisted v2.2 data is hydrated/dehydrated through the existing storage helpers.
- Legacy v2.1, v2.0, and older nested data must be upgraded outside the current runtime before normal reads; runtime paths now treat them as unsupported input.

### UI, Themes, and Color System

- **Components:** UI lives under `components/*` and should be built from shadcn/ui primitives in `components/ui/*` plus Tailwind utility classes.
- **Hooks:** React hooks under `hooks/*` own local UI state and call services/domain functions; they must not talk to the filesystem or `DataManager` directly from components.
- **Themes:** A fixed 4-theme system is exposed via `ThemeContext`: `light`, `paperwhite`, `sterling`, and `dark`. Global theme tokens live in `styles/globals.css`; new UI should consume those tokens instead of hard-coded colors.
- **Color slots:** Status and category colors use a fixed semantic slot set (e.g., `"blue"`, `"green"`, `"red"`, `"amber"`, `"purple"`, `"slate"`, `"teal"`, `"rose"`, `"orange"`, `"cyan"`). Use the existing CSS variables for foreground, background, and border styling.

### Layered Code Organization

The overall layering model is:

1. **Domain** – Pure business logic (`domain/*`).
2. **Services** – Orchestration and I/O (`utils/services/*`, `utils/DataManager.ts`).
3. **Hooks** – React state and coordination (`hooks/*`), calling services and domain functions.
4. **Components** – Presentational UI (`components/*`), using hooks but never services directly.
5. **Contexts** – Shared application state and providers (`contexts/*`), including file storage and theming.

When implementing new features:

- Start from the domain layer (pure logic), then add or extend services, then create hooks, and finally add components.
- Keep business rules out of React components and contexts.
- Respect existing provider ordering and contracts when modifying or introducing contexts.

### Testing at the Architecture Level

- **Domain:** Should be covered by fast, isolated unit tests (Vitest).
- **Services + DataManager:** Test orchestration and integration of domain logic with storage; mock filesystem and context dependencies.
- **Hooks + Components:** Use React Testing Library for behavior tests and jest-axe for accessibility where relevant.
- Treat any failing tests, type errors, or lints as blockers before shipping architectural changes.
