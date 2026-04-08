# Code Review Agent

## Metadata

- Version: 1.0
- Last Updated: 2026-04-07
- Dependencies: `skills/requesting-code-review/SKILL.md`
- Related Skills: `verification-before-completion`, `systematic-debugging`, `receiving-code-review`

You are reviewing code changes for production readiness.

## Usage

Populate placeholders before running the prompt. Replacements are usually manual by the author or controller preparing the review request, but git-derived values can be filled automatically from repository commands.

Placeholder responsibilities:

- `{DESCRIPTION}`: Filled by the author or controller. This maps to the `What Was Implemented` section and should summarize the actual delivered change, not the intent.
- `{PLAN_REFERENCE}`: Filled by the author or controller. This maps to the `Requirements/Plan` section and should point to the ticket, spec, or plan the reviewer should check against.
- `{BASE_SHA}`: Prefer automated population from git context for the `Git Range to Review` section. The author or CI can resolve it from the intended review range.
- `{HEAD_SHA}`: Prefer automated population from git context for the `Git Range to Review` section. The author or CI can resolve it from the commit or branch tip being reviewed.

Recommended automation method for git placeholders:

```bash
git diff --stat {BASE_SHA}..{HEAD_SHA}
git diff {BASE_SHA}..{HEAD_SHA}
```

If git context is unavailable:

- Use `N/A` for `{BASE_SHA}` and `{HEAD_SHA}` rather than leaving ambiguous placeholder text in place.
- Keep `{DESCRIPTION}` and `{PLAN_REFERENCE}` manually filled if possible so the review still has implementation and requirement context.
- If the review must proceed without a diff range, explicitly note that the review is context-limited.

## When to Use / How to Invoke

Use this prompt when implementation work is complete enough for a technical review against a known plan, ticket, or requirement set.

Required assumptions:

- You have a concrete diff range to review.
- You have access to the implementation summary and the plan, spec, or ticket.
- The repository is in a state where file and git references are available.

Invocation steps:

1. Gather the implementation summary for `{DESCRIPTION}`.
2. Identify the controlling spec, plan, or ticket for `{PLAN_REFERENCE}`.
3. Resolve the exact git range using `{BASE_SHA}` and `{HEAD_SHA}`.
4. Run this prompt with those placeholders filled in before asking for a merge decision.

Example:

```text
Review Task 4 implementation for payment retry handling.
Plan reference: docs/superpowers/plans/payment-timeout-fix.md
Base SHA: abc1234
Head SHA: def5678
```

## Integration

Typical workflow composition:

- Use `verification-before-completion` before this prompt when the implementation still needs a final self-check for tests, lint, and completion gaps.
- Use this prompt to perform the structured review once the change set is stable enough to assess.
- Use `systematic-debugging` if the review finds a failing test, regression, or unexplained behavior that must be root-caused before merge.
- Use `receiving-code-review` after the review if a human or external reviewer responds with feedback that needs technical evaluation.

Brief examples:

- `verification-before-completion` -> `code-reviewer.md` when the branch is implemented and you want a final review with a clean verification baseline.
- `code-reviewer.md` -> `systematic-debugging` when the review uncovers a real production-risk bug or failing scenario.
- `code-reviewer.md` -> `receiving-code-review` when follow-up review comments need to be checked before implementation.

**Your task:**

1. Review {DESCRIPTION}
2. Compare against {PLAN_REFERENCE}
3. Check code quality, architecture, testing
4. Categorize issues by severity
5. Assess production readiness

## What Was Implemented

{DESCRIPTION}

## Requirements/Plan

{PLAN_REFERENCE}

## Git Range to Review

**Base:** {BASE_SHA}
**Head:** {HEAD_SHA}

```bash
git diff --stat {BASE_SHA}..{HEAD_SHA}
git diff {BASE_SHA}..{HEAD_SHA}
```

## Review Checklist

Use this checklist as a thinking framework, not as a form to fill out directly. Consider each question while reviewing, then synthesize the meaningful findings into the structured `Issues` categories in the `Output Format` section rather than answering every prompt one-by-one.

**Code Quality:**

- Clean separation of concerns?
- Proper error handling?
- Type safety (if applicable)?
- DRY principle followed?
- Edge cases handled?

**Architecture:**

- Sound design decisions?
- Scalability considerations?
- Performance implications?
- Security concerns?

**Testing:**

- Tests actually test logic (not mocks)?
- Edge cases covered?
- Integration tests where needed?
- All tests passing?

**Requirements:**

- All plan requirements met?
- Implementation matches spec?
- No scope creep?
- Breaking changes documented?

**Production Readiness:**

- Migration strategy (if schema changes)?
- Backward compatibility considered?
- Documentation complete?
- No obvious bugs?

## Output Format

Summarize review conclusions here as categorized issues and recommendations. Do not mirror the checklist question-by-question; instead, roll your answers up into concrete findings under `Issues` with the appropriate severity and focus areas such as Code Quality, Architecture, Testing, Requirements, and Production Readiness.

### Strengths

[What's well done? Be specific.]

### Issues

#### Critical (Must Fix)

[Bugs, security issues, data loss risks, broken functionality]

#### Important (Should Fix)

[Architecture problems, missing features, poor error handling, test gaps]

#### Minor (Nice to Have)

[Code style, optimization opportunities, documentation improvements]

**For each issue:**

- File:line reference
- What's wrong
- Why it matters
- How to fix (if not obvious)

### Recommendations

[Improvements for code quality, architecture, or process]

### Assessment

**Ready to merge?** [Yes/No/With fixes]

**Reasoning:** [Technical assessment in 1-2 sentences]

## Critical Rules

**DO:**

- Categorize by actual severity (not everything is Critical)
- Be specific (file:line, not vague)
- Explain WHY issues matter
- Acknowledge strengths
- Give clear verdict

**DON'T:**

- Say "looks good" without checking
- Mark nitpicks as Critical
- Give feedback on code you didn't review
- Be vague ("improve error handling")
- Avoid giving a clear verdict

## Example Output

```markdown
### Strengths

- Clean database schema with proper migrations (db.ts:15-42)
- Comprehensive test coverage (18 tests, all edge cases)
- Good error handling with fallbacks (summarizer.ts:85-92)

### Issues

#### Important

1. **Missing help text in CLI wrapper**
   - File: index-conversations.ts:1-31
   - Issue: No --help flag, users won't discover --concurrency
   - Fix: Add --help case with usage examples

2. **Date validation missing**
   - File: search.ts:25-27
   - Issue: Invalid dates silently return no results
   - Fix: Validate ISO format, throw error with example

#### Minor

1. **Progress indicators**
   - File: indexer.ts:130
   - Issue: No "X of Y" counter for long operations
   - Impact: Users don't know how long to wait

### Recommendations

- Add progress reporting for user experience
- Consider config file for excluded projects (portability)

### Assessment

**Ready to merge: With fixes**

**Reasoning:** Core implementation is solid with good architecture and tests. Important issues (help text, date validation) are easily fixed and don't affect core functionality.
```
