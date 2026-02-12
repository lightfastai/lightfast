---
date: 2026-02-07
researcher: external-agent
topic: "Resend, Slack OAuth, Outbound Webhooks, Integrations Taxonomy"
tags: [research, web-analysis, resend, slack, webhooks, integrations, svix, outbound]
status: complete
confidence: high
sources_count: 52
---

# External Research: Notifications, Email, Webhooks Architecture

## Research Question

We need to understand: (1) Resend email integration through Knock — full API capabilities and whether Resend Audiences is needed, (2) Slack bot OAuth install flow UX best practices, (3) outbound webhook architecture patterns from industry leaders, (4) how SaaS products distinguish "integrations" vs "connectors" in their UI/docs, and (5) documentation patterns for integration setup guides.

## Executive Summary

Resend is a modern email API with excellent DX, React Email template support, and a dedicated Audiences feature for broadcast/marketing emails. When paired with Knock as notification orchestrator, Resend handles transactional email delivery while Knock manages templates, routing, preferences, batching, and multi-channel workflows. **Resend Audiences is only needed for marketing/broadcast emails** — Knock handles all notification routing without it.

For Slack integration, the OAuth V2 flow with bot tokens is the industry standard. Best-in-class products (Linear, Vercel, Notion) follow a pattern of: Settings → Integrations → "Add to Slack" button → OAuth consent → post-install channel selection. For outbound webhooks, Svix has emerged as the de facto standard for webhook infrastructure-as-a-service, used by Clerk, Clerk-like products, and many others. Stripe's webhook system remains the gold standard for self-built implementations. The "integrations vs connectors" distinction follows clear industry patterns: "integration" is user-facing, "connector" is technical, and "source/destination" indicate data direction.

## Key Findings

### 1. Resend API Capabilities

#### Core API Surface
Resend is a developer-first email API with a clean REST interface and SDKs for 8+ languages.

**Email Sending:**
- `POST /emails` — Send individual emails (supports HTML, plain text, React Email components)
- `POST /emails/batch` — Send up to 100 emails in a single API call
- `POST /emails/{id}/cancel` — Cancel a scheduled email
- Scheduling support via `scheduledAt` parameter (ISO 8601)
- Attachments support (base64 or URL)

**Domains:**
- `POST /domains` — Add custom sending domain
- DNS verification (SPF, DKIM, DMARC)
- Domain-level tracking settings (opens, clicks)

**Audiences (Marketing/Broadcast):**
- `POST /audiences` — Create contact lists
- `POST /audiences/{id}/contacts` — Add contacts to lists
- `POST /broadcasts` — Send to entire audience
- Supports segmentation and unsubscribe management

**API Keys:**
- Scoped API keys per domain
- Granular permissions (full access, sending only)

#### Resend React Email Templates
- First-class support for React components as email templates
- `@react-email/components` package for cross-client compatible components
- Server-side rendering to HTML
- Preview in browser during development
- Components: `<Html>`, `<Head>`, `<Body>`, `<Container>`, `<Section>`, `<Column>`, `<Text>`, `<Link>`, `<Image>`, `<Button>`, `<Hr>`, `<Preview>`

#### Webhook Events
Resend provides webhook events for delivery tracking:
- `email.sent` — Email accepted by Resend
- `email.delivered` — Email delivered to recipient
- `email.delivery_delayed` — Temporary delivery failure
- `email.complained` — Recipient marked as spam
- `email.bounced` — Hard bounce (permanent failure)
- `email.opened` — Email opened (requires tracking enabled)
- `email.clicked` — Link clicked (requires tracking enabled)

#### Pricing (as of 2026)
| Tier | Price | Volume | Features |
|------|-------|--------|----------|
| Free | $0/mo | 100 emails/day, 1 domain | Basic sending |
| Pro | $20/mo | 50,000 emails/mo, custom domains | + Webhooks, analytics |
| Scale | $90/mo | 100,000 emails/mo | + Dedicated IP, priority support |
| Enterprise | Custom | Custom | + SLA, custom limits |

**Audiences pricing:** Included in Pro tier and above. Contact management and broadcasts are part of the Audiences feature.

#### Resend vs Alternatives
| Factor | Resend | SendGrid | Postmark |
|--------|--------|----------|----------|
| DX Quality | Excellent (React Email, clean API) | Good (complex, legacy API) | Good (focused API) |
| React Templates | Native support | No | No |
| Pricing | Simple, transparent | Complex tiers | Per-message |
| Audiences/Marketing | Built-in (new) | Full marketing suite | Transactional only |
| Deliverability | Strong (newer reputation) | Strong (established) | Excellent (transactional focus) |
| Webhook Events | 7 event types | 14+ event types | 8+ event types |
| Best For | Dev-first teams, modern stack | Enterprise, full-featured | High-deliverability transactional |

**Sources:**
- [Resend API Documentation](https://resend.com/docs/api-reference/introduction)
- [Resend Audiences](https://resend.com/docs/dashboard/audiences/introduction)
- [React Email](https://react.email/)
- [Resend Pricing](https://resend.com/pricing)

---

### 2. Knock + Resend Integration Guide

#### How Knock Uses Resend
Knock is a notification infrastructure platform that orchestrates multi-channel notifications. Resend serves as an **email channel provider** — Knock sends the rendered email through Resend's API.

**Architecture:**
```
Your App → Knock Workflow → Knock Template Engine → Resend API → Recipient Inbox
                ↓
         (also: Slack, Push, In-App, SMS channels)
```

#### Setup Requirements
1. **Resend API Key**: Generate in Resend dashboard, add to Knock channel config
2. **Verified Domain**: Must verify sending domain in Resend (DNS records)
3. **Knock Email Channel**: Configure in Knock Dashboard → Integrations → Email → Resend
4. **Sender Settings**: Configure `from` address, reply-to, domain

#### How Templates Work
**Knock renders templates, not Resend.** This is important:
- Knock has its own template editor (visual + code)
- Templates support Liquid syntax for dynamic content
- Knock renders the final HTML and sends it to Resend as pre-rendered content
- Resend simply delivers the pre-rendered email

**Template Features in Knock:**
- Visual drag-and-drop editor
- Code editor for HTML/Liquid
- Template variables with fallbacks
- Conditional content blocks
- Partials/layouts for consistent branding
- Preview with sample data

#### Email Channel Preferences
Knock provides a preference system for email opt-in/out:
- **Per-workflow preferences**: Users can opt out of specific notification workflows
- **Per-channel preferences**: Users can opt out of email entirely while keeping in-app
- **Category preferences**: Group workflows into categories (e.g., "Marketing", "Product Updates")
- **Preference center**: Embeddable React component (`@knocklabs/react-notification-feed`)
- **API**: `PUT /users/{id}/preferences` to set preferences programmatically

#### Batch/Digest Capabilities
Knock excels at batching notifications before sending email:
- **Batch step**: Collect multiple events into a single notification
- **Batch window**: Configurable (e.g., "batch for 5 minutes", "batch for 1 hour")
- **Batch key**: Group by user, resource, or custom key
- **Digest**: Summarize batched events in a single email
- **Frequency control**: Max 1 email per hour, daily digest, etc.

Example: Instead of 15 separate "new comment" emails, Knock batches them into one email: "You have 15 new comments on Project X"

#### What Knock Adds on Top of Resend
| Feature | Resend Alone | Knock + Resend |
|---------|-------------|----------------|
| Send email | Yes | Yes |
| Multi-channel | No | Yes (email, Slack, push, in-app, SMS) |
| User preferences | No | Yes (per-workflow, per-channel) |
| Batching/Digest | No | Yes (configurable windows) |
| Workflow logic | No | Yes (delays, conditions, branches) |
| Template editor | Basic | Rich (visual + code) |
| Delivery tracking | Via webhooks | Built-in analytics |
| Retry/failover | Manual | Automatic |

**Sources:**
- [Knock Email Channel Setup](https://docs.knock.app/integrations/email/resend)
- [Knock Preferences](https://docs.knock.app/preferences/overview)
- [Knock Batch Function](https://docs.knock.app/designing-workflows/batch-function)
- [Knock Template Editor](https://docs.knock.app/designing-workflows/template-editor)

---

### 3. Resend Audiences — Analysis and Recommendation

#### What Resend Audiences Provides
Resend Audiences is a contact management and broadcast email feature:
- **Contact Lists**: Create and manage subscriber lists (audiences)
- **Contact Management**: Add, remove, update contacts with metadata
- **Broadcasts**: Send bulk emails to entire audiences
- **Unsubscribe Management**: Automatic unsubscribe link handling
- **Segmentation**: Filter contacts by metadata properties

#### When You Need Resend Audiences
| Use Case | Need Audiences? | Why |
|----------|----------------|-----|
| Product changelog emails | Yes | Broadcast to all subscribers |
| Marketing campaigns | Yes | Targeted sends to segments |
| Newsletter | Yes | Regular broadcasts to lists |
| Transactional notifications | No | Use Knock workflows |
| User-specific alerts | No | Use Knock workflows |
| Onboarding sequences | Maybe | Could use either; Knock better for multi-channel |
| Feature announcements | Maybe | Audiences for broad; Knock for targeted |

#### Recommendation for Lightfast

**Do NOT use Resend Audiences initially.** Here's why:

1. **Knock handles notification routing**: For all user-triggered notifications (new search results, job completion, workspace invites), Knock's workflow system with preferences is the right tool
2. **Audiences is for marketing**: Product update emails to all users, changelog broadcasts — these aren't needed yet
3. **Future consideration**: When Lightfast needs to send marketing emails (product updates, feature announcements), Resend Audiences becomes relevant
4. **Cost efficiency**: No additional cost — Audiences is included in Pro tier

**When to Add Audiences Later:**
- When you need to send product updates to all users regardless of Knock preferences
- When you launch a blog/changelog email subscription
- When you need marketing segmentation (e.g., "send to Enterprise users only")

**Sources:**
- [Resend Audiences Documentation](https://resend.com/docs/dashboard/audiences/introduction)
- [Resend Broadcasts](https://resend.com/docs/api-reference/broadcasts)

---

### 4. Slack OAuth Install Flow — Best Practices

#### OAuth V2 Flow Overview
Slack uses OAuth 2.0 for app installation. The flow:

```
1. User clicks "Add to Slack" button
2. Redirect to Slack authorization page
3. User selects workspace and approves scopes
4. Slack redirects back with authorization code
5. Your server exchanges code for bot token
6. Store token, redirect to settings page
```

**Bot Tokens vs User Tokens:**
| Token Type | Use When | Scopes Prefix |
|-----------|----------|---------------|
| Bot Token | App acts independently (posting messages, responding) | `chat:write`, `channels:read` |
| User Token | App acts on behalf of a user | `users:read`, `files:write` |

**Recommendation:** Use **bot tokens** for notification integrations. Request only needed scopes.

#### Common Bot Scopes for Notifications
```
chat:write          — Post messages to channels
channels:read       — List public channels (for channel picker)
groups:read         — List private channels bot is in
im:write            — Send direct messages
commands            — Register slash commands (optional)
```

#### "Add to Slack" Button Best Practices

**Placement:**
- Settings → Integrations page (most common)
- Onboarding flow (if Slack is core feature)
- Notification settings page

**Design:**
- Use Slack's official button design (brand guidelines)
- Include brief explanation of what permissions are needed
- Show what the integration does before asking for install

**Pre-Install Messaging:**
```
┌──────────────────────────────────────────┐
│  Slack Integration                        │
│                                          │
│  Get notified about search results,      │
│  job completions, and workspace events   │
│  directly in Slack.                      │
│                                          │
│  Permissions needed:                     │
│  • Post messages to channels             │
│  • Read channel list (for setup)         │
│                                          │
│  [Add to Slack]                          │
└──────────────────────────────────────────┘
```

#### How Top SaaS Products Present Slack Install

**Linear:**
- Settings → Integrations → Slack
- Clean card with description
- Single "Connect" button
- Post-install: channel mapping per project
- Granular event toggles (issue created, status changed, etc.)

**Vercel:**
- Settings → Integrations → Slack
- Explains what notifications you'll receive
- OAuth flow with minimal scopes
- Post-install: channel selection per project

**Notion:**
- Settings → Connections → Slack
- Describes bi-directional features
- Post-install: per-page notification config

**Common Pattern:**
```
Settings → Integrations → [Slack Card] → [Connect Button] → OAuth → Channel Config
```

#### Post-Install Channel Selection UX

**Best Practice: Dropdown with Channel Search**
```
┌─────────────────────────────────────────────────────┐
│ Settings > Integrations > Slack                      │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐   │
│ │  Slack Workspace: Acme Corp                    │   │
│ │  Status: ● Connected                           │   │
│ │  [Disconnect]                                  │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ Notification Channels                                │
│ ├─ Default Channel                                   │
│ │   [#general              ▼] [Test Notification]   │
│ │                                                    │
│ ├─ Search Results                                    │
│ │   [#product-alerts       ▼]                       │
│ │   ☑ New results                                   │
│ │   ☑ Job completions                               │
│ │                                                    │
│ └─ [+ Add Notification Rule]                        │
│                                                      │
│ [Cancel]                      [Save Changes]         │
└─────────────────────────────────────────────────────┘
```

**Key UX Elements:**
1. **Connection status indicator** — Green dot for connected, workspace name
2. **Test button** — Send test notification to verify config
3. **Channel dropdown** — Fetch via `conversations.list` API, searchable
4. **Event toggles** — Granular control over what triggers notifications
5. **Disconnect option** — Clear way to remove integration

#### Multi-Workspace Support
- Store installations per `team_id`
- Allow multiple workspace connections per org
- Each workspace has independent channel config
- Handle Enterprise Grid (`is_enterprise_install` flag)

#### Error Handling Patterns
| Error | Handling |
|-------|----------|
| `token_revoked` | Mark as disconnected, prompt re-auth |
| `channel_not_found` | Prompt to reconfigure, fallback to default |
| `missing_scope` | Show re-authorization flow with needed scopes |
| `rate_limited` | Queue with exponential backoff, respect `Retry-After` |
| `invalid_auth` | Check if workspace removed, prompt re-install |

#### Token Security
- **Encrypt at rest** — Use KMS or equivalent
- **Never log tokens** — Redact in logs
- **HTTPS only** — All Slack API calls over TLS
- **State parameter** — CSRF protection in OAuth flow
- **Bot tokens don't expire** by default (unless token rotation enabled)

**Sources:**
- [Slack OAuth V2](https://docs.slack.dev/authentication/installing-with-oauth/)
- [Slack API Scopes](https://api.slack.com/scopes)
- [Slack Token Rotation](https://docs.slack.dev/authentication/using-token-rotation/)
- [Slack Security Best Practices](https://docs.slack.dev/security)
- [Slack Marketplace Guidelines](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements)
- [Slack Block Kit Builder](https://app.slack.com/block-kit-builder)

---

### 5. Outbound Webhook Architecture Patterns

#### Stripe Webhooks (Gold Standard)

**Event Naming:** `resource.action` pattern
```
payment_intent.succeeded
customer.subscription.updated
invoice.payment_failed
checkout.session.completed
```

**Key Design Decisions:**
- **300+ event types** organized by resource
- **Subscription:** Dashboard + API (`POST /webhook_endpoints`)
- **Max 16 endpoints** per account
- **Signature:** HMAC-SHA256 via `Stripe-Signature` header
  ```
  Stripe-Signature: t=1678886400,v1=abc123...,v0=def456...
  ```
- **Retry:** Exponential backoff over 3 days (live), 3 attempts (test)
- **Webhook Logs:** Dashboard with request/response inspection, filtering
- **Testing:** Stripe CLI `stripe listen` + `stripe trigger`
- **Versioning:** Account-level API version pins webhook payload format

**Sources:**
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- [Stripe Event Types](https://docs.stripe.com/api/events/types)

#### GitHub Webhooks

**Event Naming:** Descriptive names with `action` field
```json
{
  "action": "opened",     // sub-action
  // ... payload
}
```
Events: `push`, `pull_request`, `issues`, `release`, `workflow_run`

**Key Design Decisions:**
- **Subscription:** UI or REST API, per-repository/organization/app
- **Signature:** HMAC-SHA256 via `X-Hub-Signature-256` header
- **NO automatic retries** — Manual redelivery only (last 3 days)
- **Headers:** `X-GitHub-Event`, `X-GitHub-Delivery` (unique ID), `X-Hub-Signature-256`
- **Webhook Logs:** Recent deliveries UI with full request/response
- **Content types:** `application/json` or `application/x-www-form-urlencoded`

**Sources:**
- [GitHub Webhooks](https://docs.github.com/en/webhooks)
- [Validating Deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

#### Clerk Webhooks (Svix-Powered)

**Event Naming:** `resource.action`
```
user.created
user.updated
session.created
organization.membership.created
```

**Key Design Decisions:**
- **Powered by Svix** — Leverages Svix infrastructure
- **Subscription:** Clerk Dashboard with visual event catalog
- **Signature:** Svix signatures (more robust than simple HMAC)
- **Retry:** Svix exponential backoff (~8 attempts over hours/days)
- **Webhook Logs:** Excellent UI with message attempts, filtering, retry buttons
- **Integration with Inngest:** Works seamlessly for complex async workflows
- **SDK:** `svix` npm package for verification

**Sources:**
- [Clerk Webhooks](https://clerk.com/docs/webhooks/overview)
- [Clerk + Inngest + Svix](https://clerk.com/blog/clerk-inngest-svix-webhooks)

#### Svix — Webhook-as-a-Service

**What Svix Provides:**
- Enterprise webhook infrastructure (sending, receiving, streaming)
- Customer-facing webhook portal
- Automatic retries with exponential backoff
- Signature verification (proprietary, more secure than HMAC)
- Event catalog and filtering
- Webhook transformation (modify payloads with JS)
- FIFO ordering option
- Comprehensive logging and debugging

**Pricing:**
| Tier | Price | Messages/Month | SLA |
|------|-------|---------------|-----|
| Free | $0 | 50,000 | 99.9% |
| Pro | $490/mo | 2,500,000 | 99.99% |
| Enterprise | Custom | Custom | 99.999% |

**SDKs:** JavaScript, Python, Ruby, Go, Rust, Java, C#, PHP, Terraform
**Open Source:** Self-hostable (Rust + PostgreSQL + Redis) under SSPL

**Build vs Buy Decision:**
| Factor | Build Your Own | Svix |
|--------|---------------|------|
| Time to market | 6-12 months | Days to weeks |
| Engineering | 3-5 engineers | 1-2 engineers |
| Annual cost | $300k-$500k (eng time) | $0-$5,880 |
| Maintenance | Ongoing | Managed |
| Features | Basic initially | Enterprise-grade day 1 |

**Recommendation:** Use Svix for customer-facing webhooks unless extreme custom requirements.

**Sources:**
- [Svix Homepage](https://www.svix.com/)
- [Svix Pricing](https://www.svix.com/pricing/)
- [Svix Documentation](https://docs.svix.com/)
- [Svix Build vs Buy](https://www.svix.com/build-vs-buy/)

#### Knock Outbound Webhooks

**Yes, Knock has outbound webhooks** for notification system events:

**Event Types:**
- Message lifecycle: `message.sent`, `message.delivered`, `message.bounced`, `message.seen`, `message.read`, `message.link_clicked`, `message.archived`, `message.unread`, `message.unseen`, `message.interacted`
- Workflow events: `workflow.updated`, `workflow.activated`
- Other: `layout.updated`, `translation.updated`, `commit.promoted`

**Key Details:**
- Subscription via Knock Dashboard, opt-in per event type
- 8 retry attempts with exponential backoff
- Can build **customer-facing webhooks** using Knock Objects + Subscriptions

**Sources:**
- [Knock Outbound Webhooks](https://docs.knock.app/developer-tools/outbound-webhooks/overview)
- [Knock Webhook Event Types](https://docs.knock.app/developer-tools/outbound-webhooks/event-types)
- [How Knock Built Webhooks](https://knock.app/blog/how-we-built-webhooks)

#### Linear Webhooks

**Event Naming:** Resource names with `action` field
```json
{
  "type": "Issue",
  "action": "create",
  "data": { ... },
  "updatedFrom": { ... }
}
```

**Key Details:**
- Subscription via Settings UI or GraphQL API (requires admin)
- HMAC-SHA256 via `Linear-Signature` header
- `@linear/sdk/webhooks` with automatic verification
- Rich payloads with `updatedFrom` for change tracking

**Sources:**
- [Linear Webhooks](https://linear.app/developers/webhooks)
- [Linear SDK Webhooks](https://linear.app/developers/sdk-webhooks)

#### Comparative Summary

| Feature | Stripe | GitHub | Clerk/Svix | Knock | Linear |
|---------|--------|--------|------------|-------|--------|
| Event naming | `resource.action` | Descriptive + action | `resource.action` | `resource.action` | Resource + action |
| Signature | HMAC-SHA256 | HMAC-SHA256 | Svix signatures | — | HMAC-SHA256 |
| Auto retry | Yes (3 days) | No | Yes (~8 attempts) | Yes (8 attempts) | — |
| Webhook logs UI | Excellent | Good | Excellent | Basic | — |
| Testing tools | CLI + Dashboard | Manual redeliver | Dashboard retry | — | — |
| Versioning | Account-level | None | Per event type | — | — |
| Max endpoints | 16 | Unlimited | Unlimited | — | — |

#### Best Practices from Industry

**Idempotency:**
- Include unique event ID in every webhook
- Receivers should track processed IDs
- Use database unique constraints for dedup
- Generate composite keys: `hash(provider + eventType + externalObjectId)`

**Ordering:**
- **Cannot guarantee ordering** in distributed systems
- Design for unordered delivery
- Use state transitions instead of assuming order
- Include timestamps and version numbers
- Svix offers FIFO option (limits throughput)

**Security:**
- HMAC-SHA256 signature on every webhook
- Include timestamp in signature to prevent replay attacks
- 5-minute tolerance window for timestamp validation
- Constant-time comparison to prevent timing attacks
- HTTPS only, never log secrets
- Support secret rotation (accept old + new during transition)

**Sources:**
- [Webhook Idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)
- [Reliable Webhook Delivery](https://www.averagedevs.com/blog/reliable-webhook-delivery-idempotent-secure)
- [Webhook Versioning](https://svix.com/blog/webhook-versioning)

---

### 6. Integrations vs Connectors Taxonomy

#### Terminology Guide

Based on analysis of 15+ major platforms:

| Term | Definition | When to Use | Examples |
|------|-----------|------------|---------|
| **Integration** | General connection between two systems | User-facing, marketing | "Slack Integration", "GitHub Integration" |
| **Connector** | Technical component that implements the connection | Technical docs, data pipelines | "PostgreSQL Connector", "Salesforce Connector" |
| **Source** | System FROM which data flows | Data pipeline products | "Google Analytics Source" |
| **Destination** | System TO which data flows | Data pipeline products | "Snowflake Destination" |
| **Channel** | Notification/communication endpoint | Notification systems | "Email Channel", "Slack Channel" |
| **Provider** | Third-party service offering the capability | Auth, email, infrastructure | "Email Provider", "Identity Provider" |
| **App** | Consumer-facing integration unit | Marketplaces | "Slack Apps", "Zapier Apps" |
| **Trigger** | Event that initiates a workflow | Automation platforms | "New Issue Trigger" |
| **Action** | Operation performed in response | Automation platforms | "Send Email Action" |

#### Industry Patterns by Product Category

**Data Pipeline Products (Segment, Fivetran, Airbyte):**
- `Source → Connector → Platform → Connector → Destination`
- "Connector" is the technical agent that does the syncing
- Clear ETL/ELT terminology
- Direction-based naming

**Integration Platforms (Zapier, Make, n8n):**
- `Trigger (when this happens) → Action (do this)`
- "App" for user-facing integrations
- "Connection" for authentication
- Workflow-centric naming

**Product Marketplaces (Notion, Linear, GitHub, Slack, Vercel):**
- "Integration" or "App" as primary user-facing term
- Category-based organization (AI, Engineering, Analytics, etc.)
- Status badges (installed, beta, featured)
- Self-serve install with OAuth

**Notification Platforms (Knock):**
- "Channel" for delivery endpoints (email, Slack, push, in-app)
- "Provider" for the service behind a channel (Resend for email, Twilio for SMS)
- "Workflow" for notification logic
- "Integration" for third-party connections

#### Naming Recommendation for Lightfast

Based on the product's nature as an AI agent orchestration tool with notification capabilities:

```
External-facing (UI):
├── Integrations (top-level page)
│   ├── Notifications
│   │   ├── Email (Resend) — Channel
│   │   ├── Slack — Channel
│   │   └── Webhooks — Channel
│   ├── Data Sources
│   │   ├── GitHub — Connector
│   │   ├── Linear — Connector
│   │   └── Notion — Connector
│   └── Tools
│       ├── Zapier — Integration
│       └── Make — Integration

Internal-facing (code/docs):
├── channels/ — Email, Slack, webhook delivery
├── connectors/ — Data source connections (GitHub, etc.)
└── providers/ — Third-party service abstractions
```

#### Marketplace UX Patterns

**Card-Based Layout** (most common):
- Logo (48-64px square) + name + one-line description
- Status badge: ✅ Connected | Available | 🧪 Beta
- Category tag
- "Configure" or "Connect" CTA

**Status Badges:**
| Badge | Meaning |
|-------|---------|
| ✅ Connected / Active | Integration installed and working |
| Available / Install | Not yet connected |
| 🧪 Beta | Testing phase |
| ✨ New | Recently added |
| ⭐ Featured / Official | Platform-endorsed |
| ⚠️ Deprecated | Being phased out |

**Sources:**
- [Zapier Glossary](https://docs.zapier.com/platform/quickstart/glossary)
- [Segment Connections](https://segment.com/docs/connections)
- [Fivetran Connectors](https://fivetran.com/docs/connectors)
- [Airbyte Sources/Destinations](https://docs.airbyte.com/platform/move-data/sources-destinations-connectors)
- [dbt Sources](https://docs.getdbt.com/docs/build/sources)
- [Notion Integrations](https://www.notion.com/integrations)
- [Linear Integrations](https://linear.app/integrations)
- [Slack Marketplace](https://slack.com/marketplace)
- [Vercel Integrations](https://vercel.com/integrations)
- [GitHub Apps](https://docs.github.com/en/apps)

---

### 7. Integration Documentation Patterns

#### Standard Documentation Structure

Based on analysis of Zapier, Make, Segment, Fivetran, GitHub, and Slack docs:

**1. Overview** (Always first)
- What the integration does (1-2 sentences)
- Key benefits and use cases
- Visual diagram of data flow
- Prerequisites checklist

**2. Prerequisites**
- Required accounts (both sides)
- Permission levels needed
- API credentials or tokens
- Plan tier requirements

**3. Setup / Installation**
- Step-by-step guide with screenshots
- Authentication flow walkthrough
- Default configuration explained
- "Test connection" verification step

**4. Configuration**
- Available settings and parameters
- Event selection / channel mapping
- Sync frequency options
- Filtering rules

**5. Testing & Verification**
- How to verify the integration works
- Send test notification
- Expected results
- Common setup issues

**6. Troubleshooting**
- Common errors and solutions
- Debug mode / logs location
- Rate limits and quotas
- Support contact

**7. Advanced** (Optional)
- Custom configurations
- API reference for developers
- Webhooks and callbacks
- Security best practices

#### Integration Status Indicators

| Status | Label | Description |
|--------|-------|-------------|
| Preview | 🔬 Preview | Invitation-only, frequent changes, not for production |
| Beta | 🧪 Beta | Open for testing, known limitations, feedback welcome |
| GA | ✅ GA | Fully supported, production-ready, SLA |
| Deprecated | ⚠️ Deprecated | Sunset date announced, migration guide available |

#### Self-Serve vs Contact Sales Decision

**Self-Serve (most integrations):**
- Prominent "Install" / "Connect" button
- OAuth flow initiated immediately
- Configuration wizard with sensible defaults
- Documentation for self-help

**Contact Sales (enterprise/complex):**
- "Contact Sales" or "Request Demo" CTA
- Custom SLA, security audit required
- Multi-stakeholder approval process
- Professional services for setup

**Hybrid (recommended for Lightfast):**
- Self-serve for standard tier
- Feature gates behind plan tiers
- "Talk to expert" link available
- Automatic upgrade prompts

**Sources:**
- [SaaS Integration UI Patterns](https://www.saasframe.io/patterns/integrations)
- [Prismatic B2B Integration Patterns](https://prismatic.io/blog/common-b2b-saas-integration-patterns-when-to-use/)

---

## Trade-off Analysis

### Resend Audiences vs Knock for Email Routing

| Factor | Resend Audiences | Knock Workflows |
|--------|-----------------|----------------|
| Best for | Marketing/broadcast emails | Transactional notifications |
| User preferences | Unsubscribe only | Full preference center (per-workflow, per-channel) |
| Multi-channel | Email only | Email + Slack + Push + In-App + SMS |
| Batching/Digest | No | Yes (configurable windows) |
| Segmentation | Contact metadata | User properties + workflow conditions |
| Template engine | Basic | Rich (visual + code + Liquid) |
| Cost | Included in Pro | Knock subscription |
| **Recommendation** | **Add later for marketing** | **Use now for all notifications** |

### Svix vs Build-Your-Own Webhooks

| Factor | Svix | Build Your Own |
|--------|------|---------------|
| Time to market | Days | 6-12 months |
| Cost (annual) | $0-$5,880 | $300k-$500k (eng time) |
| Reliability | Enterprise-grade | Depends on implementation |
| Customer portal | Built-in | Must build |
| Retry logic | Automatic, battle-tested | Must implement |
| Signature verification | Robust (Svix standard) | HMAC-SHA256 |
| Event catalog | Built-in | Must build |
| **Recommendation** | **Use for customer-facing webhooks** | **Only if extreme custom needs** |

### Slack Integration: Bolt SDK vs Raw OAuth

| Factor | @slack/bolt | Raw OAuth Implementation |
|--------|------------|--------------------------|
| Complexity | Low (handles OAuth, events, commands) | High (manual token management) |
| Features | Full framework (listeners, middleware) | Only what you build |
| Bundle size | Larger dependency | Minimal |
| Flexibility | Framework patterns | Full control |
| **Recommendation** | **Use Bolt for Slack-heavy features** | **Use raw OAuth if Slack is simple channel** |

---

## Sources

### Resend
- [Resend API Documentation](https://resend.com/docs/api-reference/introduction) - Resend, 2026
- [Resend Audiences](https://resend.com/docs/dashboard/audiences/introduction) - Resend, 2026
- [Resend Pricing](https://resend.com/pricing) - Resend, 2026
- [React Email](https://react.email/) - Resend, 2026

### Knock
- [Knock Email Channel (Resend)](https://docs.knock.app/integrations/email/resend) - Knock, 2026
- [Knock Preferences](https://docs.knock.app/preferences/overview) - Knock, 2026
- [Knock Batch Function](https://docs.knock.app/designing-workflows/batch-function) - Knock, 2026
- [Knock Outbound Webhooks](https://docs.knock.app/developer-tools/outbound-webhooks/overview) - Knock, 2026
- [Knock Webhook Event Types](https://docs.knock.app/developer-tools/outbound-webhooks/event-types) - Knock, 2026
- [How Knock Built Webhooks](https://knock.app/blog/how-we-built-webhooks) - Knock, 2025
- [Customer-Facing Webhooks with Knock](https://docs.knock.app/guides/customer-webhooks) - Knock, 2026

### Slack
- [Slack OAuth V2](https://docs.slack.dev/authentication/installing-with-oauth/) - Slack, 2026
- [Slack API Scopes](https://api.slack.com/scopes) - Slack, 2026
- [Slack Token Rotation](https://docs.slack.dev/authentication/using-token-rotation/) - Slack, 2026
- [Slack Security Best Practices](https://docs.slack.dev/security) - Slack, 2026
- [Slack Marketplace Guidelines](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements) - Slack, 2026
- [Slack Block Kit Builder](https://app.slack.com/block-kit-builder) - Slack

### Webhook Infrastructure
- [Stripe Webhooks](https://docs.stripe.com/webhooks) - Stripe, 2026
- [Stripe Event Types](https://docs.stripe.com/api/events/types) - Stripe, 2026
- [GitHub Webhooks](https://docs.github.com/en/webhooks) - GitHub, 2026
- [Clerk Webhooks](https://clerk.com/docs/webhooks/overview) - Clerk, 2026
- [Clerk + Inngest + Svix](https://clerk.com/blog/clerk-inngest-svix-webhooks) - Clerk, 2025
- [Linear Webhooks](https://linear.app/developers/webhooks) - Linear, 2026
- [Svix Homepage](https://www.svix.com/) - Svix, 2026
- [Svix Pricing](https://www.svix.com/pricing/) - Svix, 2026
- [Svix Documentation](https://docs.svix.com/) - Svix, 2026
- [Svix Build vs Buy](https://www.svix.com/build-vs-buy/) - Svix, 2026

### Best Practices
- [Webhook Idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) - Hookdeck, 2021
- [Reliable Webhook Delivery](https://www.averagedevs.com/blog/reliable-webhook-delivery-idempotent-secure) - Average Devs, 2026
- [Webhook Versioning](https://svix.com/blog/webhook-versioning) - Svix, 2024
- [Guaranteeing Webhook Ordering](https://svix.com/blog/guaranteeing-webhook-ordering) - Svix

### Integration Taxonomy
- [Zapier Glossary](https://docs.zapier.com/platform/quickstart/glossary) - Zapier
- [Segment Connections](https://segment.com/docs/connections) - Segment
- [Fivetran Connectors](https://fivetran.com/docs/connectors) - Fivetran
- [Airbyte Connectors](https://docs.airbyte.com/platform/move-data/sources-destinations-connectors) - Airbyte
- [dbt Sources](https://docs.getdbt.com/docs/build/sources) - dbt
- [Notion Integrations](https://www.notion.com/integrations) - Notion
- [Linear Integrations](https://linear.app/integrations) - Linear
- [Slack Marketplace](https://slack.com/marketplace) - Slack
- [Vercel Integrations](https://vercel.com/integrations) - Vercel
- [GitHub Apps](https://docs.github.com/en/apps) - GitHub
- [SaaS Integration UI Patterns](https://www.saasframe.io/patterns/integrations) - SaaSFrame
- [B2B Integration Patterns](https://prismatic.io/blog/common-b2b-saas-integration-patterns-when-to-use/) - Prismatic

### Security
- [HMAC Security for Webhooks](https://webhooks.fyi/security/hmac) - webhooks.fyi
- [Replay Prevention](https://webhooks.fyi/security/replay-prevention) - webhooks.fyi

---

## Open Questions

1. **Knock + Svix for customer-facing webhooks**: Knock mentions supporting customer-facing webhooks via Objects + Subscriptions. Should Lightfast use this pattern instead of (or alongside) Svix directly?

2. **Slack Enterprise Grid**: Do any current/target customers use Slack Enterprise Grid? This affects the OAuth implementation (org-wide installs vs workspace-level).

3. **Webhook event schema versioning**: Should Lightfast use account-level versioning (Stripe-style) or per-event-type versioning (Svix-style)?

4. **Resend Audiences timeline**: When does Lightfast expect to need marketing/broadcast email? This determines if Audiences setup should be in the initial integration or deferred.

5. **Svix self-hosted vs cloud**: Given Lightfast already uses Inngest for background jobs, would self-hosted Svix be worth it for cost savings, or is cloud Svix preferable for reduced ops burden?

6. **Webhook testing infrastructure**: Should Lightfast invest in a webhook testing/simulation tool (like Stripe CLI) for developers building on the platform?
