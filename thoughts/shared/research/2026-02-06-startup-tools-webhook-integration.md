---
date: 2026-02-06T00:28:22Z
researcher: Claude
git_commit: 928ce729c86a53f58528a0f7b6a808940e8f9a5d
branch: feat/relationship-graph-api
repository: lightfast
topic: "Stripe, Clerk, PostHog, Resend Webhook Integration for Relationship Graph"
tags: [research, webhooks, stripe, clerk, posthog, resend, relationship-graph, identity-mapping]
status: complete
last_updated: 2026-02-06
last_updated_by: Claude
---

# Research: Startup Tools Webhook Integration for Relationship Graph

**Date**: 2026-02-06T00:28:22Z
**Researcher**: Claude
**Git Commit**: 928ce729c86a53f58528a0f7b6a808940e8f9a5d
**Branch**: feat/relationship-graph-api
**Repository**: lightfast

## Research Question

Document webhook events and cross-tool identity mapping for Stripe, Clerk, PostHog, and Resend to extend Lightfast's relationship graph beyond GitHub/Vercel/Linear/Sentry.

## Summary

This research provides complete webhook event inventories, cross-tool identity mapping strategies, linking field analysis, and priority recommendations for integrating Stripe, Clerk, PostHog, and Resend into Lightfast's relationship graph system.

---

## 1. Webhook Event Inventory

### 1.1 Stripe Webhooks (200+ events)

| Event Category | Key Events | Linking Fields |
|----------------|-----------|----------------|
| **Payment Intent** | `payment_intent.succeeded`, `.created`, `.failed`, `.canceled` | `metadata`, `customer`, `idempotency_key` |
| **Checkout** | `checkout.session.completed`, `.expired`, `.async_payment_*` | `metadata`, `client_reference_id`, `customer`, `subscription` |
| **Customer** | `customer.created`, `.updated`, `.deleted` | `metadata`, `id`, `email` |
| **Subscription** | `customer.subscription.created`, `.updated`, `.deleted`, `.trial_will_end` | `metadata`, `customer`, `id` |
| **Invoice** | `invoice.paid`, `.payment_succeeded`, `.payment_failed`, `.created` | `metadata`, `subscription_details.metadata`, `customer` |
| **Charge** | `charge.succeeded`, `.failed`, `.refunded`, `.dispute.*` | `metadata` (from PaymentIntent), `customer`, `payment_intent` |

**Critical Payload Structure:**
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_abc123",
      "customer": "cus_xyz789",
      "metadata": {
        "commit_sha": "abc123def456",
        "deployment_id": "dep_001",
        "linear_issue_id": "LIGHT-123",
        "user_id": "user_clerk_2abc"
      }
    }
  },
  "request": {
    "idempotency_key": "unique-key-123"
  }
}
```

**Metadata Propagation Rules:**
- PaymentIntent → Charge: One-time copy at charge creation
- Checkout Session → PaymentIntent: Via `payment_intent_data.metadata`
- Checkout Session → Subscription: Via `subscription_data.metadata`
- Subscription → Invoice: Snapshot in `invoice.subscription_details.metadata`

---

### 1.2 Clerk Webhooks (30+ events)

| Event Category | Key Events | Identity Fields |
|----------------|-----------|-----------------|
| **User** | `user.created`, `user.updated`, `user.deleted` | `id`, `external_accounts[]`, `email_addresses[]` |
| **Session** | `session.created`, `session.ended`, `session.revoked` | `user_id`, `id` |
| **Organization** | `organization.created`, `.updated`, `.deleted` | `id`, `created_by` |
| **Membership** | `organizationMembership.created`, `.updated`, `.deleted` | `user_id`, `organization.id`, `role` |
| **Invitation** | `organizationInvitation.created`, `.accepted`, `.revoked` | — |

**Critical Identity Mapping - `external_accounts[]`:**
```json
{
  "type": "user.created",
  "data": {
    "id": "user_2abc123def",
    "external_accounts": [
      {
        "provider": "oauth_github",
        "providerUserId": "12345678"  // GitHub user ID!
      },
      {
        "provider": "oauth_linear",
        "providerUserId": "abc-def-123"  // Linear user ID!
      }
    ],
    "email_addresses": [
      { "email_address": "dev@example.com" }
    ],
    "public_metadata": {},
    "private_metadata": { "stripe_customer_id": "cus_xyz789" }
  }
}
```

**Provider Mapping:**
| Clerk Provider | Maps To | ID Field |
|---------------|---------|----------|
| `oauth_github` | GitHub | `providerUserId` = GitHub user ID |
| `oauth_linear` | Linear | `providerUserId` = Linear user UUID |
| `oauth_google` | Google | `providerUserId` = Google account ID |

---

### 1.3 PostHog Events & Webhooks

| Feature | Events/Triggers | Linking Properties |
|---------|----------------|-------------------|
| **Custom Events** | Any `posthog.capture()` event | `distinct_id`, `properties.*` |
| **Default Events** | `$pageview`, `$identify`, `$exception` | `distinct_id`, `$current_url`, `$os`, `$browser` |
| **Feature Flags** | `$feature_flag_called` | `$feature_flag`, `$feature_flag_response` |
| **Outbound Webhooks (CDP)** | Any event with filters | Full event payload |
| **Error Tracking Alerts** | `$exception` triggers | Issue properties |
| **Trend Alerts** | Threshold breaches | Insight context |

**Sample Event with Linking Properties:**
```json
{
  "event": "deployment_completed",
  "distinct_id": "user_clerk_2abc123",
  "properties": {
    "commit_sha": "abc123def456",
    "commit_author": "dev@example.com",
    "branch": "main",
    "linear_issue_id": "LIGHT-123",
    "github_pr_number": "456",
    "stripe_customer_id": "cus_xyz789",
    "deployment_duration_ms": 45000
  },
  "timestamp": "2024-05-29T17:32:07.202Z"
}
```

**Default Captured Properties:**
- `$os`, `$browser`, `$device_type`
- `$current_url`, `$referrer`, `$referring_domain`
- `$utm_source`, `$utm_medium`, `$utm_campaign`
- `$gclid`, `$fbclid`, `$msclkid`

---

### 1.4 Resend Webhooks (17 events)

| Event Category | Events | Linking Fields |
|----------------|--------|----------------|
| **Email Lifecycle** | `email.sent`, `.delivered`, `.bounced`, `.failed` | `email_id`, `tags`, `from`, `to`, `subject` |
| **Engagement** | `email.opened`, `.clicked`, `.complained` | `email_id`, `tags` |
| **Other** | `email.delivery_delayed`, `.scheduled`, `.suppressed`, `.received` | `email_id`, `tags` |
| **Domain** | `domain.created`, `.updated`, `.deleted` | `id`, `name`, `status` |
| **Contact** | `contact.created`, `.updated`, `.deleted` | — |

**Sample Webhook Payload:**
```json
{
  "type": "email.delivered",
  "created_at": "2024-11-22T23:41:12.126Z",
  "data": {
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "from": "Acme <notifications@app.com>",
    "to": ["user@example.com"],
    "subject": "PR Merged: LIGHT-123",
    "tags": {
      "commit_sha": "abc123",
      "issue_id": "LIGHT-123",
      "user_id": "user_clerk_2abc"
    }
  }
}
```

**Sending with Tags (for webhook linking):**
```typescript
await resend.emails.send({
  from: 'notifications@app.com',
  to: ['user@example.com'],
  subject: 'Issue Update',
  html: '<p>Your issue was updated</p>',
  tags: [
    { name: 'commit_sha', value: 'abc123' },
    { name: 'issue_id', value: 'LIGHT-123' },
    { name: 'user_id', value: 'user_clerk_2abc' }
  ]
});
```

---

## 2. Cross-Tool Identity Mapping

### 2.1 Identity Resolution Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CROSS-TOOL IDENTITY MAPPING                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │      CLERK       │
                              │  (Identity Hub)  │
                              │                  │
                              │  user_id:        │
                              │  user_2abc123    │
                              └────────┬─────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  external_      │         │  private_       │         │  email_         │
│  accounts[]     │         │  metadata       │         │  addresses[]    │
│                 │         │                 │         │                 │
│ github: 12345678│         │ stripe_customer │         │ dev@example.com │
│ linear: abc-def │         │ _id: cus_xyz789 │         │                 │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     GITHUB      │         │     STRIPE      │         │    POSTHOG      │
│                 │         │                 │         │    RESEND       │
│ commit.author.id│         │ customer.id     │         │                 │
│ = 12345678      │         │ = cus_xyz789    │         │ distinct_id =   │
│                 │         │                 │         │ user_2abc123    │
│ pr.user.id      │         │ metadata.       │         │                 │
│ = 12345678      │         │ user_id =       │         │ to: [email]     │
│                 │         │ user_2abc123    │         │                 │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         └───────────────────────────┴───────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │     RELATIONSHIP GRAPH         │
                    │                                │
                    │  actor_identity table:         │
                    │  - clerk_user_id               │
                    │  - github_user_id              │
                    │  - linear_user_id              │
                    │  - stripe_customer_id          │
                    │  - primary_email               │
                    └────────────────────────────────┘
```

### 2.2 Identity Flow Patterns

#### Clerk → Stripe Customer ID
```typescript
// Option 1: Store Stripe customer_id in Clerk private_metadata
await clerkClient.users.updateUser(userId, {
  privateMetadata: { stripe_customer_id: 'cus_xyz789' }
});

// Option 2: Store Clerk user_id in Stripe customer metadata
await stripe.customers.create({
  metadata: { clerk_user_id: 'user_2abc123' }
});
```

#### Clerk → PostHog distinct_id
```typescript
// Direct mapping: Use Clerk user ID as PostHog distinct_id
posthog.identify(clerkUser.id);  // distinct_id = "user_2abc123"
```

#### Clerk → Resend recipient
```typescript
// Use Clerk email for sending, store user_id in tags
await resend.emails.send({
  to: [clerkUser.primaryEmailAddress],
  tags: [{ name: 'user_id', value: clerkUser.id }]
});
```

#### Stripe → PostHog
```typescript
// Pass Stripe customer_id in PostHog event properties
posthog.capture('payment_completed', {
  stripe_customer_id: 'cus_xyz789',
  stripe_payment_intent_id: 'pi_abc123'
});
```

---

## 3. Linking to Existing Sources (GitHub/Vercel/Linear/Sentry)

### 3.1 Stripe Metadata for Cross-Source Linking

```typescript
// When creating payment/subscription
await stripe.paymentIntents.create({
  amount: 2999,
  currency: 'usd',
  metadata: {
    // GitHub/Vercel linking
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA,
    deployment_id: process.env.VERCEL_DEPLOYMENT_ID,
    branch: process.env.VERCEL_GIT_COMMIT_REF,

    // Linear linking
    linear_issue_id: 'LIGHT-123',

    // Identity linking
    clerk_user_id: 'user_2abc123'
  }
});
```


python

### 3.2 PostHog Properties for Cross-Source Linking

```typescript
// All custom events can carry linking properties
posthog.capture('feature_used', {
  // Git context
  commit_sha: process.env.VERCEL_GIT_COMMIT_SHA,
  branch: process.env.VERCEL_GIT_COMMIT_REF,

  // Issue tracking
  linear_issue_id: 'LIGHT-123',
  sentry_issue_id: 'CHECKOUT-456',

  // Deployment context
  deployment_id: process.env.VERCEL_DEPLOYMENT_ID,

  // User context (for error correlation)
  $set: { subscription_tier: 'pro' }
});
```

### 3.3 Clerk external_accounts[] Mapping

| Clerk Provider | Linked Source | Usage |
|---------------|---------------|-------|
| `oauth_github` | GitHub commits/PRs/issues | Match `commit.author.id`, `pr.user.id` |
| `oauth_linear` | Linear issues/comments | Match `issue.assignee.id` |
| (email fallback) | Any source with email | Match `email_addresses[].email_address` |

**Implementation:**
```typescript
// When Clerk user.created/updated webhook fires
const identityMap = {
  clerkUserId: user.id,
  githubUserId: user.external_accounts.find(
    a => a.provider === 'oauth_github'
  )?.providerUserId,
  linearUserId: user.external_accounts.find(
    a => a.provider === 'oauth_linear'
  )?.providerUserId,
  primaryEmail: user.email_addresses[0]?.email_address
};

// Store for relationship detection
await db.actorIdentity.upsert({ ...identityMap });
```

### 3.4 Resend Tags for Cross-Source Linking

```typescript
// When sending notification emails, include linking context
await resend.emails.send({
  subject: 'PR Merged: Fix checkout bug',
  tags: [
    { name: 'commit_sha', value: 'abc123' },
    { name: 'pr_number', value: '478' },
    { name: 'linear_issue', value: 'LIGHT-123' },
    { name: 'sentry_issue', value: 'CHECKOUT-456' },
    { name: 'user_id', value: 'user_clerk_2abc' }
  ]
});
```

---

## 4. Webhook Priority Matrix

### Priority 1: Must Have (High-Value, Cross-Source Links)

| Event | Source | Linking Value | Rationale |
|-------|--------|---------------|-----------|
| `user.created` | Clerk | Identity resolution | Enables GitHub/Linear user → Clerk user mapping via external_accounts |
| `user.updated` | Clerk | Identity updates | Captures new OAuth connections |
| `payment_intent.succeeded` | Stripe | Payment → code linking | Metadata can carry commit_sha, issue_id |
| `checkout.session.completed` | Stripe | Checkout → user journey | Links cart to payment to user |
| `customer.created` | Stripe | Stripe → Clerk identity | Establishes customer_id ↔ user_id mapping |

### Priority 2: Nice to Have (Adds Context)

| Event | Source | Linking Value | Rationale |
|-------|--------|---------------|-----------|
| `customer.subscription.created` | Stripe | Subscription tracking | Track plan changes over time |
| `customer.subscription.updated` | Stripe | Plan transitions | Correlate with feature usage |
| `email.delivered` | Resend | Notification tracking | Confirm communications reached users |
| `email.opened/clicked` | Resend | Engagement metrics | Track notification effectiveness |
| `session.created` | Clerk | Login events | User activity correlation |
| `organization.created` | Clerk | Team creation | Multi-tenant context |

### Priority 3: Skip (Noise for Relationship Tracking)

| Event | Source | Reason |
|-------|--------|--------|
| `invoice.*` (most) | Stripe | High volume, low signal (use invoice.paid only) |
| `charge.*` | Stripe | Redundant with payment_intent.* |
| `email.delivery_delayed` | Resend | Transient state, not actionable |
| `session.ended` | Clerk | Low value for graph |
| `domain.*` | Resend | Admin events, not user-related |
| `contact.*` | Resend | List management, not graph-related |

---

## 5. Data Flow Diagrams

### 5.1 User Signup Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER SIGNUP FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

    User signs up with GitHub OAuth
              │
              ▼
    ┌─────────────────┐
    │     CLERK       │  ──────► user.created webhook
    │                 │
    │ external_accounts:        {
    │   github: 12345678         "id": "user_2abc123",
    │                            "external_accounts": [{
    │                              "provider": "oauth_github",
    │                              "providerUserId": "12345678"
    │                            }]
    │                          }
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Actor Identity  │  Store: clerk_user_id + github_user_id
    │ Resolution      │
    └────────┬────────┘
             │
             ├──────────────────────────────────────────┐
             │                                          │
             ▼                                          ▼
    ┌─────────────────┐                      ┌─────────────────┐
    │    POSTHOG      │                      │    STRIPE       │
    │                 │                      │                 │
    │ posthog.identify│                      │ stripe.customers│
    │ ('user_2abc123')│                      │ .create({       │
    │                 │                      │   email: '...'  │
    │ distinct_id =   │                      │   metadata: {   │
    │ 'user_2abc123'  │                      │     clerk_user_ │
    │                 │                      │     id: 'user_  │
    └────────┬────────┘                      │     2abc123'    │
             │                               │   }             │
             │                               │ })              │
             ▼                               └────────┬────────┘
    ┌─────────────────┐                               │
    │    RESEND       │                               │
    │                 │◄──────────────────────────────┘
    │ Welcome email   │         customer.created
    │ tags: [         │         webhook updates
    │   user_id,      │         identity map with
    │   signup_source │         stripe_customer_id
    │ ]               │
    └─────────────────┘
```

### 5.2 Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PAYMENT FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

    User clicks "Upgrade to Pro"
              │
              ▼
    ┌─────────────────┐
    │ Checkout Session│  metadata: {
    │   Created       │    clerk_user_id: "user_2abc123",
    │                 │    commit_sha: "abc123",  // Current deploy
    │                 │    feature_flag: "new_pricing_v2"
    │                 │  }
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ checkout.session│ ──────► Webhook received
    │ .completed      │
    └────────┬────────┘
             │
             ├──────────────────────────────────────────┐
             │                                          │
             ▼                                          ▼
    ┌─────────────────┐                      ┌─────────────────┐
    │ RELATIONSHIP    │                      │    POSTHOG      │
    │ GRAPH UPDATE    │                      │                 │
    │                 │                      │ posthog.capture │
    │ Link: payment   │                      │ ('subscription_ │
    │ → deployment    │                      │   started', {   │
    │ → user          │                      │   commit_sha,   │
    │ → feature flag  │                      │   plan: 'pro',  │
    │                 │                      │   ...           │
    └────────┬────────┘                      │ })              │
             │                               └────────┬────────┘
             │                                        │
             ▼                                        ▼
    ┌─────────────────┐                      ┌─────────────────┐
    │    RESEND       │                      │ PRODUCT USAGE   │
    │                 │                      │ CORRELATION     │
    │ Upgrade confirm │                      │                 │
    │ email, tags: [  │                      │ Track: which    │
    │   commit_sha,   │                      │ deployments     │
    │   stripe_sub_id │                      │ drove pro       │
    │ ]               │                      │ upgrades        │
    └─────────────────┘                      └─────────────────┘
```

### 5.3 Notification Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NOTIFICATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

    GitHub PR merged (fixes LIGHT-123)
              │
              ▼
    ┌─────────────────┐
    │ GitHub Webhook  │  pr.head.sha: "abc123"
    │ pull_request.   │  pr.body: "Fixes #456, resolves LIGHT-123"
    │ closed (merged) │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ RELATIONSHIP    │  Edges created:
    │ GRAPH DETECTION │  - PR → GitHub Issue #456 (fixes)
    │                 │  - PR → Linear LIGHT-123 (fixes)
    │                 │  - Commit → PR (same_commit)
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Notification    │  Lookup: Who to notify?
    │ Trigger         │  - Linear issue assignee → Clerk user
    │                 │  - GitHub issue participants → Clerk users
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    RESEND       │
    │                 │
    │ Send: "PR Merged│  tags: [
    │ - LIGHT-123"    │    commit_sha: "abc123",
    │                 │    pr_number: "478",
    │                 │    linear_issue: "LIGHT-123",
    │                 │    github_issue: "456"
    │                 │  ]
    └────────┬────────┘
             │
             ├──────────────────────────────────────────┐
             │                                          │
             ▼                                          ▼
    ┌─────────────────┐                      ┌─────────────────┐
    │ email.delivered │                      │ email.opened    │
    │ webhook         │                      │ webhook         │
    │                 │                      │                 │
    │ Update graph:   │                      │ Track engagement│
    │ email → user    │                      │ (optional)      │
    │ email → PR      │                      │                 │
    │ email → issue   │                      │                 │
    └─────────────────┘                      └─────────────────┘
```

---

## 6. Implementation Recommendations

### 6.1 Recommended Webhook Handler Build Order

| Order | Handler | Events | Value |
|-------|---------|--------|-------|
| 1 | Clerk | `user.created`, `user.updated` | Identity resolution enables all cross-source actor linking |
| 2 | Stripe | `payment_intent.succeeded`, `checkout.session.completed`, `customer.created` | Payment → deployment correlation |
| 3 | PostHog (CDP) | Custom events | Bidirectional event sync |
| 4 | Resend | `email.delivered`, `email.opened` | Notification tracking |

### 6.2 Linking Fields to Extract

| Source | Primary Linking Fields | Secondary Fields |
|--------|----------------------|------------------|
| **Clerk** | `external_accounts[].providerUserId`, `id` | `email_addresses[]`, `private_metadata.stripe_customer_id` |
| **Stripe** | `customer`, `metadata.*` | `client_reference_id`, `subscription`, `payment_intent` |
| **PostHog** | `distinct_id`, `properties.*` | `$set` person properties |
| **Resend** | `email_id`, `tags.*` | `to`, `subject` |

### 6.3 Cross-Tool Identity Mapping Storage

```typescript
// Proposed schema addition: actor_identity table
export const actorIdentity = pgTable("actor_identity", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

  // Primary identifiers
  clerkUserId: varchar("clerk_user_id", { length: 50 }),

  // External provider IDs (from Clerk external_accounts[])
  githubUserId: varchar("github_user_id", { length: 50 }),
  linearUserId: varchar("linear_user_id", { length: 50 }),

  // Service customer IDs
  stripeCustomerId: varchar("stripe_customer_id", { length: 50 }),
  posthogDistinctId: varchar("posthog_distinct_id", { length: 100 }),

  // Email fallback
  primaryEmail: varchar("primary_email", { length: 255 }),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clerkIdx: uniqueIndex("actor_clerk_user_idx").on(table.workspaceId, table.clerkUserId),
  githubIdx: index("actor_github_user_idx").on(table.workspaceId, table.githubUserId),
  stripeIdx: index("actor_stripe_customer_idx").on(table.workspaceId, table.stripeCustomerId),
  emailIdx: index("actor_email_idx").on(table.workspaceId, table.primaryEmail),
}));
```

### 6.4 Confidence Levels for Each Link Type

| Link Type | Confidence | Detection Method | Example |
|-----------|------------|------------------|---------|
| Clerk → GitHub (OAuth) | **1.0** | `explicit` | `external_accounts[].providerUserId` |
| Clerk → Linear (OAuth) | **1.0** | `explicit` | `external_accounts[].providerUserId` |
| Clerk → Stripe | **1.0** | `explicit` | `private_metadata.stripe_customer_id` |
| Stripe → Deployment | **1.0** | `metadata_match` | `metadata.commit_sha` |
| PostHog → Clerk | **1.0** | `id_match` | `distinct_id === clerk_user_id` |
| Resend → Commit | **1.0** | `tag_match` | `tags.commit_sha` |
| Stripe → User (email) | **0.9** | `email_match` | `customer.email` |
| PostHog → User (email) | **0.9** | `email_match` | `$set.email` |

### 6.5 New SourceReference Types to Add

```typescript
// Extend existing SourceReference type
export interface SourceReference {
  type:
    // Existing
    | "commit" | "branch" | "pr" | "issue" | "deployment"
    | "project" | "cycle" | "assignee" | "reviewer" | "team" | "label"
    // New: Identity
    | "user"           // Clerk user ID
    | "actor"          // Cross-source actor (github/linear user ID)
    // New: Payment
    | "customer"       // Stripe customer ID
    | "payment"        // Stripe payment_intent ID
    | "subscription"   // Stripe subscription ID
    // New: Communication
    | "email"          // Resend email ID
    | "notification";  // Generic notification ID
  id: string;
  url?: string;
  label?: string;
  provider?: string;   // New: For actor type, specify provider (github, linear)
}
```

### 6.6 Sample Transformer Code Patterns

#### Clerk Webhook Transformer
```typescript
// packages/console-webhooks/src/transformers/clerk.ts
export function transformClerkUserEvent(
  event: ClerkWebhookEvent
): SourceEvent | null {
  if (event.type !== "user.created" && event.type !== "user.updated") {
    return null;
  }

  const user = event.data;
  const refs: SourceReference[] = [];

  // Primary user reference
  refs.push({
    type: "user",
    id: user.id,
  });

  // Extract GitHub identity
  const githubAccount = user.external_accounts?.find(
    (a) => a.provider === "oauth_github"
  );
  if (githubAccount) {
    refs.push({
      type: "actor",
      id: githubAccount.providerUserId,
      provider: "github",
    });
  }

  // Extract Linear identity
  const linearAccount = user.external_accounts?.find(
    (a) => a.provider === "oauth_linear"
  );
  if (linearAccount) {
    refs.push({
      type: "actor",
      id: linearAccount.providerUserId,
      provider: "linear",
    });
  }

  // Extract Stripe customer ID from metadata
  const stripeCustomerId = user.private_metadata?.stripe_customer_id;
  if (stripeCustomerId) {
    refs.push({
      type: "customer",
      id: stripeCustomerId,
    });
  }

  return {
    source: "clerk",
    sourceType: event.type,
    sourceId: `user:${user.id}`,
    title: `User ${event.type.split(".")[1]}: ${user.first_name} ${user.last_name}`,
    timestamp: new Date(event.data.updated_at).toISOString(),
    references: refs,
    actor: {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email_addresses?.[0]?.email_address,
    },
    metadata: {
      email: user.email_addresses?.[0]?.email_address,
      hasGithub: !!githubAccount,
      hasLinear: !!linearAccount,
      hasStripe: !!stripeCustomerId,
    },
  };
}
```

#### Stripe Webhook Transformer
```typescript
// packages/console-webhooks/src/transformers/stripe.ts
export function transformStripePaymentEvent(
  event: Stripe.Event
): SourceEvent | null {
  if (event.type !== "payment_intent.succeeded") {
    return null;
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const refs: SourceReference[] = [];

  // Payment reference
  refs.push({
    type: "payment",
    id: pi.id,
  });

  // Customer reference
  if (pi.customer) {
    refs.push({
      type: "customer",
      id: typeof pi.customer === "string" ? pi.customer : pi.customer.id,
    });
  }

  // Extract linking metadata
  if (pi.metadata.commit_sha) {
    refs.push({
      type: "commit",
      id: pi.metadata.commit_sha,
    });
  }

  if (pi.metadata.deployment_id) {
    refs.push({
      type: "deployment",
      id: pi.metadata.deployment_id,
    });
  }

  if (pi.metadata.linear_issue_id) {
    refs.push({
      type: "issue",
      id: pi.metadata.linear_issue_id,
      label: "related_to",
    });
  }

  if (pi.metadata.clerk_user_id) {
    refs.push({
      type: "user",
      id: pi.metadata.clerk_user_id,
    });
  }

  return {
    source: "stripe",
    sourceType: "payment.succeeded",
    sourceId: `payment:${pi.id}`,
    title: `Payment succeeded: $${(pi.amount / 100).toFixed(2)}`,
    timestamp: new Date(event.created * 1000).toISOString(),
    references: refs,
    metadata: {
      amount: pi.amount,
      currency: pi.currency,
      customer: pi.customer,
    },
  };
}
```

---

## Code References

### Existing Implementation
- `/packages/console-types/src/neural/source-event.ts:52` - `SourceReference` interface
- `/db/console/src/schema/tables/workspace-observation-relationships.ts:54` - Relationship table schema
- `/api/console/src/inngest/workflow/neural/relationship-detection.ts:45` - `detectAndCreateRelationships` function
- `/packages/console-webhooks/src/transformers/github.ts:114` - GitHub PR transformer
- `/packages/console-webhooks/src/transformers/vercel.ts:17` - Vercel deployment transformer

### Webhook Handlers to Create
- `/apps/console/src/app/(clerk)/api/clerk/webhooks/route.ts` - Clerk webhook handler
- `/apps/console/src/app/(stripe)/api/stripe/webhooks/route.ts` - Stripe webhook handler
- `/apps/console/src/app/(posthog)/api/posthog/webhooks/route.ts` - PostHog webhook handler
- `/apps/console/src/app/(resend)/api/resend/webhooks/route.ts` - Resend webhook handler

## Historical Context (from thoughts/)

- `/thoughts/shared/research/2026-02-06-startup-tools-webhook-analysis.md` - Broader webhook analysis across 30+ tools
- `/thoughts/shared/research/2026-02-06-relationship-graph-definitive-links.md` - Existing relationship graph architecture

## Related Research

- `/thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md` - Demo requirements
- `/thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md` - Search integration

## Open Questions

1. **PostHog CDP Configuration**: Should outbound webhooks send ALL events or filtered subset?
2. **Stripe Metadata Conventions**: Should we enforce a metadata schema across all Stripe objects?
3. **Email Threading**: Should Resend emails be threaded by Linear issue for conversation continuity?
4. **Identity Backfill**: When a user connects GitHub OAuth later, should we backfill relationships to existing commits?
5. **Multi-Org Identity**: How to handle a Clerk user who belongs to multiple organizations in Lightfast?
