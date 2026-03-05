# Agent Instructions

This directory contains specialized instruction files for delegating tasks to AI subagents. Each file provides context, patterns, and verification steps for a specific area of the CMSNext codebase.

## Usage

When dispatching a subagent, reference the relevant `*.agent.md` instruction file:

```
"Read .github/agents/storage.agent.md for context, then [task description]..."
```

## Available Agents

| File                           | Domain        | Use For                                       |
| ------------------------------ | ------------- | --------------------------------------------- |
| [storage.agent.md](storage.agent.md)       | Storage layer | File System Access API, autosave, persistence |
| [hooks.agent.md](hooks.agent.md)           | Custom hooks  | State management, service integration         |
| [audit.agent.md](audit.agent.md)           | Quality       | Security, a11y, performance audits            |
| [templates.agent.md](templates.agent.md)   | Delegation    | Ready-to-use prompt templates                 |
| [memories.agent.md](memories.agent.md)     | Context       | Repository-level AI memories                  |

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
