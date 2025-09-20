# Commit Message Quick Reference

## Standard Format
```
<type>: <description>

• <change 1>
• <change 2>
• <change 3>

<additional context if needed>
```

## Common Types
- **feat:** New features or enhancements
- **fix:** Bug fixes
- **refactor:** Code improvements without functionality changes
- **perf:** Performance optimizations
- **docs:** Documentation updates
- **test:** Test additions or updates
- **chore:** Build, dependencies, maintenance

## Examples

### Simple Commit
```
fix: Resolve duplicate error reporting in boundaries
```

### Complex Commit
```
feat: Implement stateless DataManager architecture

• Create DataManager with pure read→modify→write pattern
• Add React hooks for component integration
• Eliminate data caching to prevent sync issues
• Maintain backward compatibility during migration

Resolves race conditions and improves multi-tab safety.
```

### Breaking Change
```
refactor!: Replace FileStorageAPI with DataManager

BREAKING CHANGE: FileStorageAPI methods no longer available.
Use DataManager hooks instead: useDataManager().getAllCases()
```

## Setup
Run once to configure Git template:
```bash
./.github/setup-commit-template.sh
```

## Usage
```bash
# Quick commit
git commit -m "feat: Add new feature"

# Detailed commit (opens editor with template)
git commit
```