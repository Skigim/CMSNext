# CMSNext Audit Guidelines

> Standards and checklists for code review, quality assurance, and release readiness.

**Last Updated:** December 29, 2025  
**Version:** 1.0

---

## Quick Reference

| Area | Standard | Threshold | Frequency |
|------|----------|-----------|-----------|
| **Tests** | 534+ tests passing | 100% | Pre-commit |
| **Build** | TypeScript + Vite | Zero errors | Pre-commit |
| **Coverage** | Critical paths tested | ≥80% | Weekly |
| **Performance** | Core metrics tracked | Baseline + 10% | Monthly |
| **Accessibility** | jest-axe violations | Zero critical | Per PR |
| **Security** | OWASP Top 10 | No high/critical | Monthly |
| **Documentation** | JSDoc + feature catalogue | 85%+ code | Release |

---

## 1. Pre-Commit Checklist

Before pushing any code, verify:

### 1.1 TypeScript Compilation
```bash
npm run build
```
- **Standard:** Zero TypeScript errors
- **Check:** Compiler output shows no `error TS` messages
- **Action:** Fix all errors before committing

### 1.2 Test Suite
```bash
npm run test
```
- **Standard:** All 534+ tests pass
- **Check:** Output shows `Test Files X passed (Y)` with no failures
- **Action:** Fix failing tests; skip only with documented reason

### 1.3 Code Quality
- **JSDoc Coverage:** Every exported function/class has JSDoc
- **Type Safety:** No `any` types unless documented
- **Imports:** No unused imports; all dependencies are listed
- **File Size:** Single files under 500 lines (split if larger)

---

## 2. Code Review Standards

### 2.1 Architecture Compliance

**Rule:** All code follows established patterns in `copilot-instructions.md`

Verify:
- ✅ Services are stateless (no instance variables holding data)
- ✅ All mutations go through `DataManager`
- ✅ No direct file system calls outside `FileStorageService`
- ✅ Hooks call services, not vice versa
- ✅ Components call hooks, not services directly
- ✅ No localStorage/sessionStorage for case data

**Reference:** `.github/copilot-instructions.md` → Architecture section

### 2.2 Data Flow Compliance

**Rule:** Data flows in one direction: FileSystem → DataManager → Services → Contexts → Hooks → Components

Verify:
- ✅ Components don't mutate state directly
- ✅ No bidirectional dependencies between layers
- ✅ All async operations use `useCallback` or memoization
- ✅ Context changes trigger proper re-renders
- ✅ Autosave is never bypassed

**Red Flags:**
- 🚩 Direct `useState` mutations without service calls
- 🚩 Circular imports between modules
- 🚩 Props drilling more than 3 levels
- 🚩 Services calling hooks

### 2.3 Testing Requirements

**Per Pull Request:**

- [ ] New features have unit tests
- [ ] Hooks have integration tests with mocked services
- [ ] Components have rendering tests
- [ ] Accessibility tests pass (jest-axe)
- [ ] Edge cases are tested (null, empty, large datasets)

**Minimum Coverage:**
- Critical paths: ≥90%
- UI components: ≥80%
- Utilities: ≥85%

### 2.4 Documentation Requirements

**Per Pull Request:**

- [ ] JSDoc added for all exported functions/classes
- [ ] Usage examples provided for complex logic
- [ ] Type interfaces documented
- [ ] Error handling documented
- [ ] Feature catalogue updated (if user-facing)
- [ ] Breaking changes logged

---

## 3. Accessibility Audit

**Standard:** Zero critical/high severity violations

### 3.1 Automated Testing

```bash
npm run test -- --reporter=verbose 2>&1 | grep -i "violations"
```

Every component must pass:
```typescript
const results = await axe(container);
expect(results).toHaveNoViolations();
```

### 3.2 Manual Testing

For complex components, manually verify:

- **Keyboard Navigation:** Tab through all interactive elements
- **Screen Reader:** Use NVDA (Windows) or VoiceOver (Mac)
- **Color Contrast:** Verify text meets WCAG AA (≥4.5:1)
- **Focus Indicators:** Clear, visible focus rings on all buttons/inputs
- **ARIA Labels:** All interactive elements have proper labels

### 3.3 Common Issues Checklist

- [ ] Buttons have descriptive text or aria-labels
- [ ] Form inputs have associated labels
- [ ] Images have alt text (or empty alt if decorative)
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] Color not sole method of conveying information
- [ ] Interactive elements are ≥44px (mobile) or ≥40px (desktop)
- [ ] No flashing content (≥3Hz)

**Reference:** `docs/development/testing-infrastructure.md` → Accessibility Testing

---

## 4. Performance Audit

**Frequency:** Monthly (or before major releases)

### 4.1 Build Metrics

```bash
npm run build
```

Check console output:
- **JS Bundle Size:** Track growth; flag if >10% increase
- **CSS Bundle Size:** Should stay under 150KB gzipped
- **Asset Count:** Minimize HTTP requests
- **Build Time:** Should complete in <30 seconds

### 4.2 Runtime Performance

Use Chrome DevTools Lighthouse:

1. Load app with `npm run dev`
2. Open DevTools → Lighthouse
3. Run audit (mobile + desktop)
4. Verify scores:
   - **Performance:** ≥90
   - **Accessibility:** ≥95
   - **Best Practices:** ≥90
   - **SEO:** ≥90

### 4.3 Critical Paths

For key features, measure:

- **Case Load Time:** < 1 second for 100 cases
- **Financial Item Add:** < 500ms
- **Alert Match:** < 2 seconds for 1000 alerts
- **File Encrypt/Decrypt:** < 3 seconds per 50MB
- **Autosave Trigger:** < 100ms debounce + write time

**Tools:**
- Chrome DevTools Performance tab
- `performanceTracker` utility in codebase
- `telemetryCollector` for real-world metrics

---

## 5. Security Audit

**Frequency:** Monthly (or after adding new dependencies)

### 5.1 Dependency Check

```bash
npm audit
```

- [ ] No high/critical vulnerabilities
- [ ] Patch all security updates within 1 week
- [ ] Document any acceptable risks in security log

### 5.2 Code Security Checklist

- [ ] No hardcoded secrets (API keys, passwords)
- [ ] Input validation on all user input
- [ ] Output encoding for XSS prevention
- [ ] CSRF protection (if applicable)
- [ ] SQL injection not applicable (local-first)
- [ ] Encryption at rest (AES-256-GCM) ✅
- [ ] Encryption in transit (HTTPS only) — assumed by File System API
- [ ] No PII in logs or telemetry
- [ ] No sensitive data in localStorage

### 5.3 OWASP Top 10 Checklist

- [ ] **Broken Access Control:** No unauthorized data access
- [ ] **Cryptographic Failures:** Encryption always used for data
- [ ] **Injection:** Input validated; no dynamic code execution
- [ ] **Insecure Design:** Architecture reviewed against attacks
- [ ] **Security Misconfiguration:** No debug mode in production
- [ ] **Vulnerable Components:** Dependencies audited regularly
- [ ] **Authentication Failures:** Password derivation correct (PBKDF2, 100k)
- [ ] **Data Integrity Failures:** File checksums validated
- [ ] **Logging Failures:** Security events logged
- [ ] **Supply Chain Risks:** Dependency sources verified

**Reference:** `contexts/EncryptionContext.tsx` for encryption implementation

---

## 6. Quality Score Standards

**Feature Scoring Model** (from feature-catalogue.md)

| Score | Criteria | Examples |
|-------|----------|----------|
| **95–100** | Near-ideal; only incremental gains remain | _Reserved for exceptional maturity_ |
| **85–94** | Advanced, polished; fine-tuning or edge cases | Case Management (92), Local Storage (90) |
| **70–84** | Solid implementation; clear improvements outstanding | Dashboard (70), Autosave (74) |
| **50–69** | Core capability present but fragile/incomplete | _Avoid in production_ |
| **0–49** | Foundational gaps; not marketable | _Do not release_ |

### 6.1 Quality Audit Process

For each feature:

1. **Rate Current State:** 0–100 based on model above
2. **Document Strengths:** What works well?
3. **List Gaps:** What's incomplete or fragile?
4. **Propose Roadmap:** How to improve by next quarter?
5. **Update Feature Catalogue:** Log date and owner

### 6.2 Critical Path Quality

All features in critical user workflows must score ≥80:

- ✅ **Case Management:** 92/100
- ✅ **Local Storage:** 90/100
- ✅ **Financial Operations:** 90/100
- ✅ **VR Generator:** 88/100
- ✅ **Notes:** 84/100
- ⚠️ **Dashboard:** 70/100 (needs investment)
- ⚠️ **Autosave Recovery:** 74/100 (telemetry pending)

---

## 7. Release Readiness Checklist

Before releasing to production:

### 7.1 Code Quality ✅
- [ ] All tests passing (534+)
- [ ] TypeScript compilation zero errors
- [ ] No console warnings in browser dev tools
- [ ] No `TODO`, `FIXME`, or `HACK` comments in critical paths
- [ ] JSDoc coverage ≥85%

### 7.2 Documentation ✅
- [ ] Feature catalogue updated
- [ ] Release notes written
- [ ] Breaking changes documented
- [ ] API changes recorded
- [ ] Upgrade guide created (if needed)

### 7.3 Performance ✅
- [ ] Build completes in <30 seconds
- [ ] JS bundle <500KB gzipped
- [ ] Critical paths measured (all <3s)
- [ ] Lighthouse scores ≥90 on all categories
- [ ] No memory leaks in extended testing

### 7.4 Security ✅
- [ ] npm audit shows no high/critical vulnerabilities
- [ ] Encryption implementation verified
- [ ] Input validation comprehensive
- [ ] No secrets in codebase
- [ ] Error messages don't leak information

### 7.5 Accessibility ✅
- [ ] jest-axe reports zero violations
- [ ] Keyboard navigation tested
- [ ] Screen reader tested (NVDA or VoiceOver)
- [ ] Color contrast verified (WCAG AA)
- [ ] All interactive elements properly labeled

### 7.6 User Testing ✅
- [ ] Feature tested with real users (if applicable)
- [ ] Edge cases handled gracefully
- [ ] Error messages are clear
- [ ] Recovery paths documented
- [ ] Feedback loop established

---

## 8. Audit Frequency & Responsibility

| Audit Type | Frequency | Owner | Tools |
|-----------|-----------|-------|-------|
| Pre-commit | Per push | Developer | `npm run build test` |
| Code Review | Per PR | Reviewer | GitHub + Static Analysis |
| Accessibility | Per PR | Reviewer | jest-axe + Manual Testing |
| Performance | Monthly | Tech Lead | Lighthouse + DevTools |
| Security | Monthly | Tech Lead | npm audit + OWASP checklist |
| Quality Scoring | Quarterly | Product | Feature Catalogue |
| Release Readiness | Before release | Team | Full checklist above |

---

## 9. Continuous Improvement

### 9.1 Metrics to Track

- **Test Pass Rate:** Target 100% (currently 100%)
- **Build Success Rate:** Target 100%
- **Bundle Size Trend:** Flag any >10% growth
- **Performance Score Trend:** Maintain ≥90
- **Accessibility Violations:** Target zero
- **Security Vulnerabilities:** Target zero
- **Code Coverage:** Maintain ≥80%

### 9.2 Quarterly Reviews

Every quarter:

1. Review all audit metrics from past 3 months
2. Update feature quality scores
3. Identify bottlenecks and gaps
4. Plan improvements for next quarter
5. Update this document with new standards

### 9.3 Incident Log

Maintain a log of:
- Security vulnerabilities found and fixed
- Performance incidents and root causes
- Accessibility issues reported
- Test flakiness and resolution
- Breaking changes and migration paths

---

## 10. References & Tools

### Documentation
- [copilot-instructions.md](./.github/copilot-instructions.md) — Architecture patterns
- [feature-catalogue.md](./feature-catalogue.md) — Quality scoring model
- [testing-infrastructure.md](./testing-infrastructure.md) — Test setup and patterns
- [JSDOC_ROLLOUT_PROGRESS.md](./JSDOC_ROLLOUT_PROGRESS.md) — Documentation coverage

### Tools
- **Testing:** Vitest + React Testing Library + jest-axe
- **Linting:** ESLint (configured in `eslint.config.js`)
- **Performance:** Chrome DevTools Lighthouse
- **Security:** npm audit + OWASP checklist
- **Accessibility:** jest-axe + NVDA/VoiceOver

### Commands

```bash
# Build & Test
npm run build                 # TypeScript + Vite compile
npm run test                  # Full test suite
npm run test:watch           # Watch mode
npm run lint                 # ESLint check

# Performance
npm run dev                  # Local dev server
# Then: DevTools → Lighthouse

# Security
npm audit                    # Check for vulnerabilities
npm audit fix               # Auto-fix if possible
```

---

## 11. Sign-Off

This document represents the quality standards for CMSNext as of **December 29, 2025**.

**Status:** Active  
**Next Review:** March 31, 2026

Maintainers: Development Team
