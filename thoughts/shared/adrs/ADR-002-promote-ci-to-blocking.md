# ADR-002: Promote CI Architecture Checks to Blocking

## Status

**Proposed** (Target: 2-4 weeks after PR #357 merges)

## Context

The Architecture Evaluation workflow runs on all PRs but is currently **non-blocking** (`continue-on-error: true`). This means:
- PRs can merge even with Tier 1 (critical) violations
- Findings are informational only
- No enforcement of architectural boundaries

This non-blocking approach was chosen for Phase 1-2 to:
1. **Monitor false positive rate** - Ensure rules are accurate before enforcing
2. **Allow gradual adoption** - Team can address existing violations without blocking new work
3. **Tune rules based on reality** - Adjust `.dependency-cruiser.cjs` based on real usage

**Current Metrics** (as of Phase 2 completion):
- **37 total violations** detected across the monorepo
- **3 Tier 1 findings** (critical architectural violations)
- **100% signal ratio** (all findings are actionable, no noise)
- **False positive rate**: Estimated < 5% based on manual review

## Decision

Promote the Architecture Evaluation workflow to **blocking** status after meeting these criteria:

### Promotion Criteria

1. **False Positive Rate < 15%** (Target: < 10%)
   - Track false positives via `.arch-eval-ignore.json` suppressions
   - Review Tier 1 findings weekly to identify false alarms

2. **Monitoring Period Complete** (2-4 weeks from PR #357 merge)
   - Allows time for:
     - Team to get familiar with the system
     - Rule tuning based on edge cases
     - Suppression list to stabilize

3. **Existing Violations Addressed or Suppressed**
   - All Tier 1 findings either:
     - Fixed via refactoring
     - Documented as accepted technical debt in `.arch-eval-ignore.json`

### Promotion Process

When criteria are met:

1. **Remove `continue-on-error: true`** from `.github/workflows/arch-eval.yml`:
   ```yaml
   - name: Run dependency boundary check
     run: pnpm lint:deps
     # continue-on-error: true  # REMOVED - now blocking
   ```

2. **Update suppression list** to document all accepted violations with:
   - Clear `reason` explaining why it's acceptable
   - Optional `expires` date to force re-evaluation

3. **Communicate to team**:
   - Announce in #architecture Slack channel
   - Update team onboarding docs
   - Remind in all-hands meeting

4. **Monitor for 1 week** after promotion:
   - Be responsive to any blocking issues
   - Fast-track suppressions for legitimate edge cases
   - Revert to non-blocking if false positive rate spikes

## Consequences

### Benefits

- **Prevents new violations** - Tier 1 violations are caught immediately
- **Enforces architectural decisions** - Boundaries are protected by CI, not just documentation
- **Improves code review quality** - Reviewers can focus on business logic, CI handles architecture
- **Maintains codebase health** - Architecture doesn't degrade over time

### Costs

- **PR friction** - Developers must fix or suppress violations before merging
- **Potential bottlenecks** - If false positives block legitimate work
- **Maintenance overhead** - Suppression list and rules need ongoing care

### Mitigation Strategies

- **Fast suppression process** - Team leads can quickly add suppressions for legitimate cases
- **Clear documentation** - README explains how to interpret and fix findings
- **Gradual rollout** - Start with dependency-cruiser only, add turbo boundaries later
- **Escape hatch** - `workflow_dispatch` allows manual approval for urgent fixes

## Alternatives Considered

### Option A: Keep Non-Blocking Permanently

**Pros:** Zero friction, no risk of blocking legitimate work
**Cons:** No enforcement, architecture degrades over time
**Decision:** Rejected - defeats the purpose of having rules

### Option B: Make Blocking Immediately

**Pros:** Immediate enforcement, no transition period
**Cons:** High risk of false positives blocking work, no time to tune
**Decision:** Rejected - too risky without validation

### Option C: Blocking for New Code Only (ratcheting)

**Pros:** Prevents new violations without requiring fixes to old code
**Cons:** Complex to implement, doesn't address existing violations
**Decision:** Deferred - consider for Phase 3 if needed

## Implementation Checklist

When promoting to blocking:

- [ ] Verify false positive rate < 15% over past 2 weeks
- [ ] Review all Tier 1 findings - fixed or documented
- [ ] Update `.arch-eval-ignore.json` with all accepted violations
- [ ] Remove `continue-on-error: true` from workflow
- [ ] Announce to team in #architecture Slack
- [ ] Update `internal/arch-eval/README.md` status section
- [ ] Monitor for 1 week, be responsive to issues

## Timeline

- **PR #357 Merge**: Architecture Evaluation goes live (non-blocking)
- **Week 1-2**: Monitor false positive rate, tune rules
- **Week 3**: Review Tier 1 findings, plan fixes or suppressions
- **Week 4**: Promotion decision (if criteria met)
- **Week 5+**: Blocking enforcement, monitor for issues

## References

- [Initial Implementation PR #357](https://github.com/lightfastai/lightfast/pull/357)
- [Architecture Evaluation README](../../internal/arch-eval/README.md)
- [Initial Baseline](../../thoughts/shared/evaluations/baselines/2026-02-07-initial-baseline.json)
