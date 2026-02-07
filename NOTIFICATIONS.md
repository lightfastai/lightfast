# Notification Philosophy

This document defines how Lightfast decides when, how, and who to notify. It is the human-readable companion to the type-safe rubric in `packages/console-types/src/notifications/rubric.ts`.

## Core Philosophy

**Lightfast notifications represent insights, not events.**

Users already receive GitHub emails, Vercel Slack messages, and Linear inbox items. Lightfast adds no value by duplicating per-tool notifications. Instead, Lightfast notifications answer one question:

> "What did the system discover that no single tool could tell me?"

### Three Principles

**1. Insights over Events**
A notification is justified only when Lightfast's memory pipeline has produced understanding beyond what the raw event conveys. A PR merge is an event. A PR merge that closes a cluster of related Sentry issues, triggers a production deploy, and completes a Linear epic — that's an insight.

**2. Quiet by Default**
New workspaces produce near-zero notifications. As the system accumulates observations, detects patterns, and learns the team's rhythm, notification volume increases gradually. Lightfast starts quiet and earns the right to notify.

**3. Earned Attention**
Every notification must pass a cost-benefit test: the cost of the user's attention must be justified by the value of what they learn.

## Decision Tree

For every event that enters the memory pipeline, the system walks through this decision tree before dispatching a notification.

```
                        ┌──────────────────────┐
                        │  1. EVENT CATEGORY    │
                        │  What kind of event?  │
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
         ┌─────────┐        ┌──────────┐        ┌───────────┐
         │ CRITICAL │        │ WORKFLOW │        │ AMBIENT   │
         └────┬────┘        └────┬─────┘        └─────┬─────┘
              │                   │                     │
              ▼                   ▼                     ▼
    2. NOTIFY IMMEDIATELY   3. WORTHINESS TEST    Store only.
    Skip remaining steps.   (see below)           No notification.
              │                   │
              ▼                ┌──┴──┐
         INTERRUPT          Pass?  Fail?
         (in-app + email)      │      │
                               ▼      ▼
                    4. MATURITY   Store only.
                       CHECK
                         │
                      ┌──┴──┐
                   Seed  Growing/Mature
                    │         │
                    ▼         ▼
               Suppress    5. GROUPING
               or batch    STRATEGY
                              │
                   ┌──────────┼──────────┐
                   ▼          ▼          ▼
              Real-time   Batched    Digest
```

## Event Categories

| Category | Definition | Examples | Action |
|----------|-----------|----------|--------|
| **CRITICAL** | Production impact, security, data loss risk | `deployment.error`, security vulnerabilities | Immediate notification, skip worthiness test |
| **WORKFLOW** | State changes in development workflow | PR merged, release published, issue opened | Apply worthiness test |
| **AMBIENT** | Routine activity, low information value | Pushes, successful deploys, dependency updates | Store only, digest inclusion |

## Worthiness Test (WORKFLOW Events)

Five questions, each scored 0 or 1. An event must score >= 3 to warrant individual notification:

| # | Question | Score = 1 | Score = 0 |
|---|----------|----------|----------|
| W1 | **Actionable?** Can the user do something right now? | PR needs review, deploy needs rollback | PR merged (already done) |
| W2 | **Cross-tool?** Connects events across integrations? | PR merge triggers deploy triggers errors | Single-source event |
| W3 | **Relevant?** Based on ownership, assignment? | User authored the PR, is assigned the issue | Unrelated team activity |
| W4 | **Novel?** First occurrence, not a duplicate? | New pattern detected, first in cluster | 5th push to same PR |
| W5 | **Miss cost?** Would user suffer seeing this tomorrow? | Production failure, blocking issue | Successful deploy |

**Scoring thresholds**:
- 5/5: Notify immediately (interrupt channel)
- 3-4/5: Notify via batch (aware channel)
- 1-2/5: Digest only (inform channel)
- 0/5: Store only

## Workspace Maturity Model

Notification volume adapts to workspace maturity:

| Stage | Criteria | Behavior |
|-------|----------|----------|
| **Seed** | < 50 observations, 1-2 sources | Near-silent. CRITICAL only. |
| **Growing** | 50+ observations, 2+ sources | Cautious. CRITICAL real-time, WORKFLOW in digest. |
| **Mature** | 500+ observations, 3+ sources, correlations | Full capability. Targeted notifications. |

**Target volumes per user per week**:
- Seed: 0-1 (critical only)
- Growing: 3-5 (critical + digests)
- Mature: 10-20 (critical + workflow + digests)

**Anti-fatigue guardrail**: If any user receives > 30 notifications/week, WORKFLOW events auto-downgrade to digest-only.

## Channel Tiers

| Knock Workflow | Tier | Channels | Batching |
|---------------|------|----------|----------|
| `critical-alert` | Interrupt | In-app + Email | None (immediate) |
| `workflow-update` | Aware | In-app + Email | 15-minute batch |
| `daily-digest` | Inform | Email | Daily (9 AM UTC) |
| `weekly-summary` | Ambient | Email | Weekly (Monday 9 AM UTC) |

## Event Taxonomy

### GitHub Events

| Event | Category | Notify? | Channel | Target |
|-------|----------|---------|---------|--------|
| `push` | Ambient | No | Digest | All |
| `pull-request.opened` | Workflow | Conditional | Aware | Reviewers |
| `pull-request.closed` | Ambient | No | Digest | All |
| `pull-request.merged` | Workflow | Conditional | Aware | Actor-aware |
| `pull-request.reopened` | Workflow | Yes | Aware | Actor-aware |
| `pull-request.ready-for-review` | Workflow | Yes | Aware | Reviewers |
| `issue.opened` | Workflow | Conditional | Aware | Assignee |
| `issue.closed` | Ambient | No | Digest | All |
| `issue.reopened` | Workflow | Yes | Aware | Assignee |
| `release.published` | Workflow | Yes | Aware | All |
| `release.created` | Workflow | No | Inform | All |
| `discussion.created` | Ambient | No | Digest | All |
| `discussion.answered` | Ambient | No | Digest | All |

### Vercel Events

| Event | Category | Notify? | Channel | Target |
|-------|----------|---------|---------|--------|
| `deployment.created` | Ambient | No | Digest | All |
| `deployment.succeeded` | Ambient | No | Digest | All |
| `deployment.ready` | Ambient | No | Digest | All |
| `deployment.error` | Critical | Yes | Interrupt | Actor-aware |
| `deployment.canceled` | Workflow | Conditional | Aware | Owner |

## Targeting Rules

| Rule | Behavior |
|------|----------|
| `all_members` | All org members receive notification |
| `owner_only` | Only the resource owner |
| `assignee_only` | Only assigned users |
| `reviewers_only` | Only requested reviewers |
| `actor_excluded` | Everyone except the person who triggered the event |
| `actor_aware` | Everyone including actor, but actor gets different messaging |

## When Should a User Expect an Email?

- **Always**: Security vulnerabilities, production incidents, breaking changes
- **Usually**: Release published, deployment failures, cross-tool correlations
- **Digest only**: PR activity summaries, velocity insights, pattern reports
- **Never by default**: Routine pushes, successful deploys, dependency updates

## Source of Truth

- **Type-safe rubric**: `packages/console-types/src/notifications/rubric.ts`
- **Event map**: `packages/console-types/src/notifications/event-map.ts`
- **Classifier**: `api/console/src/inngest/workflow/notifications/classifier.ts`
- **Dispatch**: `api/console/src/inngest/workflow/notifications/dispatch.ts`

This document should be updated whenever the rubric types or event map change.
