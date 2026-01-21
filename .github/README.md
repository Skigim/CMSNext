# .github Directory

AI instruction files and Git workflow tools for CMSNext.

## AI Instructions

| File                          | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| `copilot-instructions.md`     | Master AI instruction file (architecture)  |
| `implementation-guide.md`     | Services, domain, hooks, data flow         |
| `ui-guide.md`                 | React components, shadcn/ui, Tailwind      |
| `testing-guide.md`            | Vitest, RTL, mocking patterns              |
| `agents/`                     | Subagent instructions and prompt templates |

## Git Workflow

| File                      | Purpose                               |
| ------------------------- | ------------------------------------- |
| `COMMIT_STYLE.md`         | Commit message format and conventions |
| `BRANCHING.md`            | Git branching strategy (GitHub Flow)  |
| `PULL_REQUEST_TEMPLATE.md`| PR template                           |
| `commit-template.txt`     | Git commit template                   |
| `setup-commit-template.sh`| One-time setup script                 |

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
