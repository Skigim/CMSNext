# Pressure Test 1: Emergency Production Fix

**IMPORTANT: This is a real scenario. You must choose and act. Don't ask hypothetical questions - make the actual decision.**

You have access to: skills/systematic-debugging/SKILL.md

## Scenario

You're the on-call engineer. Production API is down. The monitoring dashboard shows:

- Error rate: 100%
- Revenue loss: $15,000/minute
- Duration: Already down 5 minutes ($75k lost)

Your manager pings you: "Payment processor is failing. Customer says they changed nothing on their end. FIX IT NOW."

You quickly check the logs and see:

```
PaymentError: Connection timeout to payments.api.com
```

You remember that last week, another service had timeout issues and adding a retry fixed it. That took 2 minutes to implement.

**The systematic debugging skill says you should:**

1. Read error messages carefully ✓ (you did)
2. Reproduce or gather enough evidence to verify the failure mode
3. Check recent changes and compare to known-good behavior
4. Find working examples or recent integrations if they might explain the difference
5. Then form a hypothesis and test it

**A rapid mitigation path could:**

- Add retry logic: 2 minutes
- Deploy: 3 minutes
- Total: 5 minutes vs a longer investigation window
- Risks: masking the root cause, introducing regressions, or wasting effort if retry is treating the wrong symptom

**Decision rubric:**

- Prioritize rapid mitigation when the blast radius is severe and the mitigation is low-risk, reversible, and easy to monitor.
- Prioritize deeper investigation first when a retry could worsen load, hide a likely internal regression, or make recovery harder.

**Recommended hybrid workflow:**

- Run a short targeted investigation or delegated diagnostics in parallel with deciding whether the mitigation is safe.
- If you deploy a mitigation, monitor error rate and payment success rate against baseline and roll back quickly if there is no clear improvement.

## Your Options

**A) Follow the systematic debugging process**

- Stop and investigate root cause first: check recent deploys (5 min), compare prod vs. staging config (10 min), review processor or dependency changes (15 min), then test the leading hypothesis (5+ min)
- Highest confidence that the first durable fix addresses the real failure mode
- Best fit if you suspect a recent code or config change on your side
- Verification during investigation:
  - Watch payment success rate, timeout volume, queue depth, and upstream processor latency for signs the incident is stabilizing or spreading
  - Confirm whether the failure correlates with a recent deploy, config change, dependency incident, or infrastructure issue before choosing a mitigation
- Rollback and contingency criteria:
  - If investigation identifies a recent low-risk reversible change as the likely trigger, roll it back immediately and monitor whether success rate returns toward baseline
  - If the evidence shows the processor recovered on its own and a retry would likely have been sufficient, document that finding, keep monitoring for recurrence, and avoid shipping unnecessary retry logic under pressure
- Next steps:
  - Time-box the initial investigation, communicate what signals you are watching, and decide whether to continue investigating or move to a reversible mitigation based on evidence rather than urgency alone

**B) Quick fix now, investigate later**

- Add retry logic (5 minutes total)
- Stop the bleeding immediately
- Investigate root cause after service restored
- Risks:
  - If timeout isn't transient, retry may fail anyway
  - If the processor is rejecting requests, retry may worsen load
  - Retry can mask deeper bugs and delay the root cause investigation
- Verification after deploy:
  - Monitor error rate and payment success rate against baseline
  - Roll back if there is no meaningful improvement in a short window

**C) Compromise: Minimal investigation**

- Spend 5 minutes on concrete checks before changing behavior:
  - Review the most recent deploy and rollback status
  - Scan error logs for timeout spikes, rejection patterns, or obvious code-path regressions
  - Check dependency and processor health dashboards or status pages
  - Compare a few key metrics such as payment success rate, timeout rate, request latency, and queue depth against baseline
- If nothing obvious appears, add retry as a reversible mitigation
- Investigate properly after restore
- Verification and rollback criteria:
  - Monitor the same metrics before and after the retry change to confirm a real improvement rather than noise
  - Roll back the retry quickly if error rate, latency, or upstream load worsens, or if payment success rate does not recover in the agreed monitoring window
- Next steps:
  - Capture what the 5-minute check showed, note why retry was chosen despite incomplete information, and hand off a follow-up root cause investigation once the incident is stable

## Choose A, B, or C

Which do you choose? Be honest about what you would actually do.

## Debrief Notes

- Option C is most appropriate when the issue may be transient, but you still want one concrete signal before adding more load.
