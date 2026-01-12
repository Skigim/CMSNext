````chatagent
# Agent Instructions: Auditing

## Overview

This agent conducts code quality, security, accessibility, and performance audits for CMSNext. Audits verify architecture compliance, identify vulnerabilities, check accessibility standards, and measure performance against established baselines.

## Key Files

| File                                      | Purpose                        |
| ----------------------------------------- | ------------------------------ |
| `.github/copilot-instructions.md`         | Architecture patterns          |
| `docs/development/AUDIT_GUIDELINES.md`    | Full audit procedures          |
| `docs/audit/AUDIT_REPORT_*.md`            | Previous audit reports         |
| `domain/**/*.ts`                          | Pure business logic (no I/O)   |
| `utils/services/*.ts`                     | Service layer (I/O operations) |

## Audit Commands

```bash
npm run build          # TypeScript compilation (0 errors required)
npm run test           # Full test suite (859+ tests must pass)
npm run lint           # ESLint check
npm audit              # Security vulnerabilities
npm run test -- --coverage  # Coverage report
````

## Core Thresholds

| Area          | Threshold        | Action if Failed       |
| ------------- | ---------------- | ---------------------- |
| Tests         | 859+ passing     | Block until fixed      |
| Build         | Zero errors      | Block until fixed      |
| Coverage      | ≥80% critical    | Flag for review        |
| Lighthouse    | ≥90 all cats     | Investigate regression |
| Accessibility | Zero violations  | Block until fixed      |
| Security      | No high/critical | Patch within 1 week    |
| Bundle Size   | <500KB gzipped   | Investigate growth     |

## Architecture Compliance

### Layer Structure (verify no violations)

```
1. Domain (domain/)       → Pure functions, no I/O, no React
2. Services (utils/)      → Orchestration, I/O operations
3. Hooks (hooks/)         → React state + service/domain calls
4. Components (components/) → UI only, call hooks
5. Contexts (contexts/)   → Global state providers
```

### Domain Layer Rules

- [ ] No I/O operations (file system, network, clipboard)
- [ ] No React dependencies (hooks, context, state)
- [ ] No side effects (logging, telemetry, toasts)
- [ ] Pure functions only (input → output)
- [ ] Types imported from `@/types/*` only

### Red Flags (fail audit if found)

- 🚩 Direct `useState` mutations without service calls
- 🚩 Circular imports between modules
- 🚩 Services calling hooks
- 🚩 Domain functions with I/O or React dependencies
- 🚩 localStorage/sessionStorage for case data
- 🚩 Props drilling more than 3 levels

## Security Audit

### Dependency Check

```bash
npm audit
```

**Severity Handling:**

- **Critical/High:** Block release, patch immediately
- **Moderate:** Patch within 2 weeks
- **Low:** Patch in next release cycle

### Code Security Checklist

- [ ] No hardcoded secrets (API keys, passwords)
- [ ] Input validation via `domain/common/sanitization.ts`
- [ ] XSS prevention via sanitization functions
- [ ] No dynamic code execution (`eval`, `new Function`)
- [ ] Encryption at rest (AES-256-GCM via `EncryptionContext`)
- [ ] No PII in logs or telemetry
- [ ] Password derivation uses PBKDF2 with 100k+ iterations

### OWASP Top 10

- [ ] A01: No unauthorized data access
- [ ] A02: Encryption for sensitive data
- [ ] A03: Input validated, no injection
- [ ] A04: Architecture reviewed
- [ ] A05: No debug mode in production
- [ ] A06: Dependencies audited
- [ ] A07: Strong password derivation
- [ ] A08: File checksums validated
- [ ] A09: Security events logged
- [ ] A10: Dependency sources verified

## Accessibility Audit

### Automated Testing

All components must pass jest-axe:

```typescript
const results = await axe(container);
expect(results).toHaveNoViolations();
```

### Manual Checklist

- [ ] Keyboard navigation through all interactive elements
- [ ] Clear focus indicators on buttons/inputs
- [ ] Screen reader compatible (NVDA/VoiceOver)
- [ ] Color contrast ≥4.5:1 (WCAG AA)
- [ ] ARIA labels on all interactive elements
- [ ] Logical heading hierarchy (h1 → h2 → h3)
- [ ] Touch targets ≥44px on mobile
- [ ] Respects `prefers-reduced-motion`

## Performance Audit

### Build Metrics

```bash
npm run build
```

**Thresholds:**

- Build time: <30 seconds
- JS bundle (gzipped): <500KB total
- CSS bundle (gzipped): <25KB
- Largest chunk: <200KB gzipped

### Lighthouse Targets

| Category       | Target |
| -------------- | ------ |
| Performance    | ≥90    |
| Accessibility  | ≥95    |
| Best Practices | ≥90    |
| SEO            | ≥90    |

### Critical Path Benchmarks

| Operation             | Target |
| --------------------- | ------ |
| Case list load (100)  | <1s    |
| Case detail open      | <500ms |
| Financial item add    | <500ms |
| Alert matching (1000) | <2s    |
| Dashboard widgets     | <1s    |

## Verification

After completing an audit:

1. **Generate Report:** Use template in `docs/audit/`
2. **Log Findings:** Categorize as Critical/High/Medium/Low
3. **Create Issues:** For anything High or above
4. **Update Roadmap:** Add remediation to current roadmap
5. **Schedule Follow-up:** Set next audit date

## Audit Report Template

```markdown
# CMSNext Audit Report - [Month Year]

**Date:** [Date]
**Auditor:** [Name/Agent]
**Scope:** [Full/Partial]

## Summary

| Area          | Status | Notes             |
| ------------- | ------ | ----------------- |
| Build         | ✅/❌  |                   |
| Tests         | ✅/❌  | X/859             |
| Security      | ✅/❌  | X vulnerabilities |
| Accessibility | ✅/❌  | X violations      |
| Performance   | ✅/❌  | Lighthouse: X     |

## Findings

### Critical

[List findings]

### High

[List findings]

## Next Audit

**Due:** [Date]
```

## Common Pitfalls

- ❌ Running audit without fresh `npm install`
- ❌ Ignoring moderate security vulnerabilities
- ❌ Skipping manual accessibility testing
- ❌ Not checking domain layer for I/O leaks
- ❌ Forgetting to update audit schedule after report

## Audit Schedule

| Type          | Frequency | Next Due         |
| ------------- | --------- | ---------------- |
| Security      | Monthly   | January 31, 2026 |
| Accessibility | Monthly   | January 31, 2026 |
| Performance   | Monthly   | January 31, 2026 |
| Full Audit    | Quarterly | March 31, 2026   |

```

```
