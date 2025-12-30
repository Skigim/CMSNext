# Agent Instructions

This directory contains specialized instruction files for delegating tasks to AI subagents. Each file provides context, patterns, and verification steps for a specific area of the CMSNext codebase.

## Usage

When dispatching a subagent, reference the relevant instruction file:

```
"Read .github/agents/SERVICES.md for context, then [task description]..."
```

## Available Agents

| File                         | Domain           | Use For                                       |
| ---------------------------- | ---------------- | --------------------------------------------- |
| [NextAgent.md](NextAgent.md) | General          | Full project context, architecture overview   |
| [SERVICES.md](SERVICES.md)   | Data layer       | DataManager, services, CRUD operations        |
| [STORAGE.md](STORAGE.md)     | Storage layer    | File System Access API, autosave, persistence |
| [UI.md](UI.md)               | React components | shadcn/ui, Tailwind, accessibility            |
| [HOOKS.md](HOOKS.md)         | Custom hooks     | State management, service integration         |
| [TESTING.md](TESTING.md)     | Unit tests       | Vitest, RTL, mocking patterns                 |
| [TEMPLATES.md](TEMPLATES.md) | Delegation       | Ready-to-use prompt templates                 |

## Instruction File Structure

Each instruction file follows this format:

1. **Overview** - What this area does and its responsibilities
2. **Key Files** - Important files and their purposes
3. **Architecture** - How components fit together
4. **Patterns** - Code patterns to follow with examples
5. **Verification** - How to verify changes work correctly
6. **Common Pitfalls** - What to avoid

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
