# Branching Strategy

This project uses **GitHub Flow** - a simple, trunk-based workflow.

## Branch Structure

```
main ─────●─────●─────●─────●─────●─────
           \       /         \       /
            feature-1         feature-2
```

- **`main`** - Production-ready code, always deployable
- **`feature/*`** - Short-lived feature branches

## Workflow

### Starting a Feature

```bash
# Always start from up-to-date main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature-name
```

### Working on a Feature

```bash
# Commit often with clear messages
git commit -m "feat: add priority scoring to dashboard"
git commit -m "fix: correct timezone handling in dates"
git commit -m "test: add tests for priority queue"

# Push to remote
git push origin feature/my-feature-name
```

### Merging to Main

```bash
# Ensure tests pass
npm test
npm run build

# Merge to main
git checkout main
git pull origin main
git merge feature/my-feature-name

# Push and clean up
git push origin main
git branch -d feature/my-feature-name
git push origin --delete feature/my-feature-name
```

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | Description                         |
| ----------- | ----------------------------------- |
| `feat:`     | New feature                         |
| `fix:`      | Bug fix                             |
| `refactor:` | Code change (no new feature or fix) |
| `test:`     | Adding/updating tests               |
| `docs:`     | Documentation only                  |
| `chore:`    | Build, tooling, dependencies        |
| `style:`    | Formatting, no code change          |

## Branch Protection (Recommended)

Set up in GitHub → Settings → Branches → Branch protection rules:

1. **Branch name pattern:** `main`
2. **Require pull request before merging:** Optional for solo work
3. **Require status checks to pass:**
   - ✅ Require branches to be up to date
   - Add required checks: `build`, `test`
4. **Do not allow bypassing the above settings:** Disabled (admin can bypass)

## Quick Reference

```bash
# Start feature
git checkout -b feature/xyz

# Save progress
git commit -m "feat: description"
git push origin feature/xyz

# Finish feature
git checkout main && git merge feature/xyz && git push

# Clean up
git branch -d feature/xyz
```
