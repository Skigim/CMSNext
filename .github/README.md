# Git Workflow Tools

This folder contains tools and templates to maintain consistent, high-quality commit messages for the CMSNext project.

## 📁 Files

### `commit-template.txt`
Complete commit message template with examples and guidelines. Used by Git when you run `git commit` without `-m`.

### `setup-commit-template.sh`
One-time setup script to configure Git to use our commit template.

**Usage:**
```bash
./.github/setup-commit-template.sh
```

### `COMMIT_STYLE.md`
Quick reference guide for commit message formats and conventions.

### `vscode-commit-snippets.json`
VS Code snippets for quick commit message creation. 

**To use in VS Code:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Search "Configure User Snippets"
3. Select "git-commit"
4. Copy contents from `vscode-commit-snippets.json`
5. Type `commit`, `commits`, or `commitb` in commit messages

## 🚀 Quick Start

1. **Set up Git template:**
   ```bash
   ./.github/setup-commit-template.sh
   ```

2. **For simple commits:**
   ```bash
   git commit -m "feat: Add awesome feature"
   ```

3. **For complex commits:**
   ```bash
   git commit
   # Editor opens with template
   ```

## 📝 Commit Types

- **feat:** New features or enhancements
- **fix:** Bug fixes  
- **refactor:** Code improvements without functionality changes
- **perf:** Performance optimizations
- **docs:** Documentation updates
- **test:** Test additions or updates
- **chore:** Build, dependencies, maintenance

## ✨ Examples

### Good Commits
```
feat: Implement stateless DataManager architecture

• Create DataManager with pure read→modify→write pattern
• Add React hooks for component integration  
• Eliminate data caching to prevent sync issues
• Maintain backward compatibility during migration

Resolves race conditions and improves multi-tab safety.
```

### Quick Commits
```
fix: Resolve duplicate error reporting in boundaries
```

```
docs: Update API documentation for DataManager
```

## 🎯 Benefits

- **Consistent format** across all commits
- **Clear change tracking** for project history
- **Easy code review** with structured messages
- **Automated changelog** generation potential
- **Better collaboration** with descriptive commits