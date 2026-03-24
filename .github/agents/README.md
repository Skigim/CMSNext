# Custom Agents

This directory contains focused custom agent definitions for delegating bounded work to Copilot subagents. Reference material and reusable workflows now live under `.github/skills/` rather than being modeled as agents.

## Usage

When dispatching a subagent, reference the relevant agent definition for the target domain.

```
"Read the `storage` agent definition for context, then [task description]..."
```

The default workspace agent is also instructed through `.github/copilot-instructions.md` to delegate automatically when a task clearly matches one of these domains. `Explore` is a built-in read-only discovery agent, not a repository-defined agent in this folder.

## Available Agents

| Agent      | Domain                   | Use For                                                                        |
| ---------- | ------------------------ | ------------------------------------------------------------------------------ |
| `frontend` | Frontend and UI          | Components, app-shell flows, styling, accessibility, and visual behavior       |
| `domain`   | Domain logic             | Pure business rules, validation, calculations, and transformations             |
| `services` | Services and DataManager | Orchestration, read-modify-write flows, and file-backed mutations              |
| `testing`  | Testing                  | Vitest, React Testing Library, jest-axe, failures, and coverage                |
| `storage`  | Storage layer            | File System Access API, autosave, persistence                                  |
| `hooks`    | Custom hooks             | State management, service integration                                          |
| `audit`    | Quality                  | Security, accessibility, performance, and architecture audits                  |
| `Explore`  | Built-in discovery       | Broad read-only discovery when the right files or code paths are not yet clear |

## Related Skills

| Skill            | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| Repo memories    | Concentrated repository conventions and reminders                          |
| Agent delegation | Choosing the right customization primitive and drafting delegation prompts |

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
