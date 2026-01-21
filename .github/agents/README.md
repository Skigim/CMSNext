# Agent Instructions

This directory contains specialized instruction files for delegating tasks to AI subagents. Each file provides context, patterns, and verification steps for a specific area of the CMSNext codebase.

## Usage

When dispatching a subagent, reference the relevant instruction file:

```
"Read .github/agents/STORAGE.md for context, then [task description]..."
```

## Available Agents

| File                           | Domain        | Use For                                       |
| ------------------------------ | ------------- | --------------------------------------------- |
| [STORAGE.md](STORAGE.md)       | Storage layer | File System Access API, autosave, persistence |
| [HOOKS.md](HOOKS.md)           | Custom hooks  | State management, service integration         |
| [AUDIT.md](AUDIT.md)           | Quality       | Security, a11y, performance audits            |
| [TEMPLATES.md](TEMPLATES.md)   | Delegation    | Ready-to-use prompt templates                 |
| [MEMORIES.md](MEMORIES.md)     | Context       | Repository-level AI memories                  |

## Consolidated Guides

For major development areas, see the consolidated guides in `.github/`:

| Guide                     | Focus                                |
| ------------------------- | ------------------------------------ |
| `implementation-guide.md` | Services, domain, hooks, data flow   |
| `ui-guide.md`             | React components, shadcn/ui, Tailwind|
| `testing-guide.md`        | Vitest, RTL, mocking patterns        |

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
