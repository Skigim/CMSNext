# .github Directory

AI instruction files and Git workflow tools for CMSNext.

## AI Instructions

| File                             | Purpose                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `copilot-instructions.md`        | Master AI instruction file (architecture)                                                                            |
| `instructions/*.instructions.md` | Path-scoped Copilot instructions for implementation, frontend, and tests                                             |
| `agents/*.agent.md`              | Focused custom agents for triage, audit, frontend, domain, hooks, services, storage, documentation, and testing work |
| `skills/*/SKILL.md`              | On-demand skills for repo memory and delegation workflows                                                            |
| `implementation-guide.md`        | Services, domain, hooks, data flow                                                                                   |
| `ui-guide.md`                    | React components, shadcn/ui, Tailwind                                                                                |
| `testing-guide.md`               | Vitest, RTL, mocking patterns                                                                                        |
| `agents/`                        | Custom agent definitions                                                                                             |
| `skills/`                        | Skill folders with references and assets                                                                             |

## Workflow Docs

- `docs/development/features/README.md` defines the repo-native feature delivery workflow and artifact tree for spec, design, task plan, and alignment work.
- `docs/development/features/templates/` contains the starter templates for those artifacts.

## Copilot Customization Structure

- `copilot-instructions.md` is the single workspace-wide instruction entry point for this repo. Do not add `AGENTS.md` alongside it.
- `instructions/*.instructions.md` provide path-scoped or task-scoped guidance and should include a keyword-rich `description` in frontmatter.
- `agents/*.agent.md` are reserved for focused personas with explicit tool scopes, including the documentation and registry specialist.
- `skills/*/SKILL.md` are reserved for repeatable on-demand workflows and reference material that should not be modeled as agents.
- `copilot-instructions.md` also defines when the default agent should automatically delegate to `audit`, `frontend`, `domain`, `hooks`, `services`, `storage`, `documentation`, `testing`, or `Explore` based on task type.

## Git Workflow

| File                       | Purpose                               |
| -------------------------- | ------------------------------------- |
| `COMMIT_STYLE.md`          | Commit message format and conventions |
| `BRANCHING.md`             | Git branching strategy (GitHub Flow)  |
| `PULL_REQUEST_TEMPLATE.md` | PR template                           |
| `commit-template.txt`      | Git commit template                   |
| `setup-commit-template.sh` | One-time setup script                 |

### Quick Start

```bash
# Set up Git commit template (one-time)
./.github/setup-commit-template.sh

# Simple commit
git commit -m "feat: Add awesome feature"

# Detailed commit (opens editor with template)
git commit
```

See [COMMIT_STYLE.md](COMMIT_STYLE.md) for full conventions.
