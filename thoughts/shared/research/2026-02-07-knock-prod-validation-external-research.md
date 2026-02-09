---
date: 2026-02-07
researcher: external-agent
topic: "Knock Notification Integration - Production Validation"
tags: [research, web-analysis, knock, resend, notifications, production, security]
status: complete
confidence: high
sources_count: 28
---

# External Research: Knock Production Validation

## Research Question
Validate Knock notification integration for production deployment. Specifically: environment promotion workflow, enhanced security mode, Resend channel configuration, MCP automation capabilities, email template strategy, rate limits, and deliverability requirements.

## Executive Summary

Knock uses a strict environment isolation model with version-controlled content resources (workflows, layouts, partials, translations) that must be committed in development and promoted to production — direct production edits are disabled by default. Channel configurations (e.g., Resend API key, sender settings) are **account-level resources that update immediately across environments without commits**, but each environment has its own independent configuration page. Enhanced security mode is recommended for production and requires RS256 JWT signing with a PEM-encoded private key stored as `KNOCK_SIGNING_KEY`. The Knock CLI (`knock commit promote --to=production`) enables CI/CD-automated promotion, and the MCP server provides ~30 tools for workflow management but **cannot delete resources** and is recommended only for development environments due to LLM non-determinism. For email templates, Knock renders templates server-side and sends pre-rendered HTML to Resend — React Email templates in the codebase would bypass Knock's template engine entirely, losing batching variables, preference integration, and visual editing capabilities.

---

## Key Findings

### 1. Knock Production Deployment Requirements

**Sources**: [Going to Production](https://docs.knock.app/getting-started/going-to-production), [Environments](https://docs.knock.app/concepts/environments), [Commits](https://docs.knock.app/concepts/commits)

#### Environment Model
- **Two default environments**: Development and Production (custom environments like staging can be added)
- **Complete data isolation**: Users, tenants, objects, messages, analytics, logs — all per-environment, NOT version-controlled
- **Version-controlled content**: Workflows, guides, layouts, partials, translations, reusable requests — committed and promoted between environments
- **Content flows upward only**: Development → Staging → Production. You cannot promote from production downward
- **Pre-January 2026 accounts**: Production write access disabled by default, requiring development-to-production promotion

#### Production Deployment Checklist (from official docs)
1. **Update API keys** to point to your Knock Production environment (found in Platform > API Keys)
2. **Promote all work** to the Production environment — committed content in development must be promoted
3. **Enable enhanced security mode** — generate a signing key, enable it for client-side requests
4. **Configure channel providers** per environment (Resend API key, sender settings)
5. **Migrate recipient data** — users with `name`, `email`, `phone_number` and custom properties
6. **Set default preferences** — per-workflow opt-in/opt-out defaults at environment level
7. **Test with sandbox mode** before full deployment

#### Channel Configuration Per Environment
Channel configurations (Resend API key, sender settings) are **account-level resources that are NOT version-controlled** — they update immediately without requiring commits. However, each environment has its **own independent configuration page**:
- Dashboard → Channels and sources → Select Resend channel → "Manage configuration" per environment
- You can use "Copy from Development" to easily copy settings to Production
- Sandbox mode toggle is per-environment
- Tracking settings (open, link-click) are per-environment

#### Commit and Promotion Process
- **A commit is NOT a save**: Saved drafts work only in the test runner, not for API-invoked workflows
- You must explicitly commit changes for them to take effect
- Before committing, you can review diffs showing changes vs. the most recently committed version
- Individual or multiple commits can be promoted simultaneously
- **Rollback**: "Revert commit" creates a new commit that restores the previous state. Reverts must be made in development and promoted to production
- **Programmatic**: Both Management API and CLI support programmatic commits

### 2. Knock MCP Automation Capabilities

**Sources**: [MCP Server](https://docs.knock.app/developer-tools/mcp-server), [Agent Toolkit](https://docs.knock.app/developer-tools/agent-toolkit/overview), [Knock CLI](https://docs.knock.app/cli/overview)

#### MCP Server Overview
- ~30 standard tools available (more when workflows-as-tools is enabled)
- Built on **service tokens** — scoped to specific resources and environments
- Currently **beta**, local deployment only (remote MCP server in development)
- Tool filtering via `--tools` flag: `--tools *` (all), `--tools users.*` (category), `--tools users.createOrUpdateUser workflows.*` (specific)

#### What CAN Be Automated via MCP
- Workflow creation using natural language
- Workflow triggering for testing
- Test data creation (users, tenants)
- Resource reading and listing (workflows, channels, environments, commits)
- User management (create, update)

#### What CANNOT Be Automated via MCP
- **Deletion of any resources** — by design, no delete tools
- **Environment creation/deletion** — dashboard only
- **Enhanced security mode toggle** — dashboard only
- **Channel provider configuration** (Resend API key) — dashboard only
- **Signing key generation** — dashboard only
- **Branding configuration** — dashboard only

#### What SHOULD Be Done via CLI (Not MCP)
- `knock commit promote --to=production` — promote committed changes
- `knock workflow pull --all` / `knock workflow push` — sync workflows to/from local files
- `knock layout pull --all` / `knock layout push` — sync layouts
- CI/CD integration with GitHub Actions

#### Critical Warning
> "Due to the non-deterministic nature of LLMs it's recommended that you test running the MCP against resources in your development environment before running it in production"

### 3. Resend Template Strategy

**Sources**: [Resend Integration](https://docs.knock.app/integrations/email/resend), [Email Layouts](https://docs.knock.app/integrations/email/layouts), [Template Editor](https://docs.knock.app/designing-workflows/template-editor), [Batch Function](https://docs.knock.app/designing-workflows/batch-function), [Email Settings](https://docs.knock.app/integrations/email/settings)

#### How Knock Templates Work
- **Knock renders templates, Resend delivers them**: Knock's template engine processes Liquid syntax, variables, conditionals → outputs final HTML → sends to Resend API
- **Two editing modes**: Visual drag-and-drop editor OR code editor (HTML + Liquid)
- **Layouts**: Reusable HTML frames with `{{content}}` injection point; "No layout" option for full custom HTML at template level
- **Partials**: Reusable content blocks shared across templates
- **CSS auto-inlining**: Knock automatically inlines CSS for email client compatibility
- **Variables available**: `{{ data.* }}`, `{{ recipient.* }}`, `{{ actor.* }}`, `{{ vars.* }}` (account-level), branding variables

#### Custom HTML via Data Payload Override
Knock supports **JSON payload overrides** that merge into the API call sent to Resend. This allows passing custom arguments to Resend's API (like custom metadata, tags, etc.). However, **this does NOT allow sending raw pre-rendered HTML to bypass Knock's template engine** — the template is always rendered by Knock.

#### Batching and Templates
When using batch steps, templates receive special variables:
- `{{ total_activities }}` — total count of batched activities
- `{{ total_actors }}` — count of unique triggering actors
- `{{ activities }}` — array of up to 10 activity objects (configurable on Enterprise to 100)
- `{{ actors }}` — array of up to 10 unique actor objects
- Batch data payload: nested structures are removed, only scalar values retained, most-recent values win

#### Can Templates Be Version-Controlled in Codebase?
**Yes, partially** — via the Knock CLI:
- `knock workflow pull --all` exports workflow definitions (including template content) as files
- `knock workflow push` syncs local changes back to Knock
- Templates are stored as part of workflow step definitions
- This enables Git version control of template content
- BUT: the visual editor in the dashboard can also modify templates, requiring discipline to keep in sync

#### React Email Templates vs Knock Templates — Trade-offs

| Factor | Knock Templates | React Email (Codebase) |
|--------|----------------|----------------------|
| **Developer Experience** | Visual editor + code editor; Liquid syntax | React components; TypeScript; npm ecosystem |
| **Version Control** | Via CLI pull/push; can diverge from dashboard edits | Native Git; PR review; standard workflow |
| **Preview/Testing** | Built-in preview pane + test runner in dashboard | Browser preview during dev; `react.email` dev server |
| **Batch Support** | Native: `activities`, `total_activities`, `actors` variables | Must manually construct batch data before rendering |
| **Rollback** | Commit history with revert in dashboard | Git revert; standard |
| **Multi-Channel** | Same template system across email, push, in-app | Email only; separate systems for other channels |
| **Dynamic Content** | Liquid syntax (loops, conditionals, filters) | Full React/JSX power |
| **Preference Integration** | Native: templates only render if preferences allow | Must check preferences before rendering |
| **Team Collaboration** | Non-devs can edit templates in dashboard | Requires code changes + deployment |
| **CSS Compatibility** | Auto-inlined by Knock | Must handle manually (or use `@react-email/components`) |
| **Custom Fonts** | `<link>` in layout `<head>` | Same approach |

**Recommendation**: Use **Knock templates** for notification emails because:
1. Batch variables (`activities`, `total_activities`) are only available in Knock's template engine
2. Preference checks are automatic — bypassing Knock means re-implementing preference logic
3. Templates are synced with other channels (in-app, Slack) for consistent messaging
4. CLI pull/push provides version control capability
5. Non-developer team members can iterate on templates without code deployments

**Exception**: If you need extremely complex email layouts (interactive components, advanced React logic), consider rendering React Email on your server and sending the HTML through Resend directly — but this bypasses Knock's workflow entirely.

### 4. Security Best Practices

**Sources**: [Security and Authentication](https://docs.knock.app/in-app-ui/security-and-authentication), [Security at Knock](https://docs.knock.app/security)

#### Enhanced Security Mode
- **What it does**: Requires client-side requests to include both the public API key AND a signed JWT user token
- **When enabled**: Knock rejects any client request using only the public API key without a token
- **Recommendation**: Enable for production; leave disabled in development for faster iteration

#### Signing Key Details
- Found in Dashboard → Platform → API Keys → generate signing key
- **Two formats provided**:
  1. **Base-64 encoded PEM** (single line) — recommended for environment variables: `KNOCK_SIGNING_KEY="LS0tLS1CRUdJTi..."`
  2. **PEM encoded** (multi-line, under "Advanced") — may be required by certain libraries
- **Algorithm**: RS256 (RSA with SHA-256)
- **Common error if format wrong**: `"secretOrPrivateKey must be an asymmetric key when using RS256"` — solution: use the base-64 encoded format

#### JWT Requirements
| Claim | Required | Purpose |
|-------|----------|---------|
| `sub` | **Required** | User ID being authenticated |
| `iat` | Recommended | Timestamp when token was issued |
| `exp` | Recommended | Token expiration timestamp |

#### Token Generation
```typescript
// Backend (Node.js)
import Knock from "@knocklabs/node";
const knock = new Knock(process.env.KNOCK_API_KEY);

const token = await knock.signUserToken(userId, {
  // Optional: override default env var
  signingKey: process.env.KNOCK_SIGNING_KEY,
  // Optional: custom expiration (default: 3600s = 1 hour)
  expiresInSeconds: 3600,
});
```

#### Token Lifecycle Best Practices
- **Match session expiration**: Sync Knock token expiration with your auth session token lifecycle
- **Short-lived tokens**: Use brief expiration windows if session sync isn't feasible
- **Refresh callback**: Knock client exposes `onUserTokenExpiring` callback for proactive renewal
- **Re-authentication**: Call `authenticate()` again with new token; real-time connection restarts automatically

#### Payload Data Guidelines
While Knock doesn't publish specific payload restrictions:
- **Data minimization**: Only include data needed for notification rendering
- **Avoid sensitive PII**: Don't include SSNs, financial details, passwords, API keys in trigger payloads
- **Use user references**: Pass user IDs and let Knock resolve user data from its user records
- **Knock compliance**: SOC 2 Type 2, GDPR, HIPAA, CCPA certified
- **Encryption**: All data encrypted at rest; TLS 1.2 for all cross-service communication
- **Server logs**: Retained for maximum 1 year, then permanently deleted

#### API Security
- **Per-environment API keys**: Development and Production have separate keys
- **Service tokens**: For server-to-server (CLI, CI/CD, Agent Toolkit) — grants broad access, scope carefully
- **Public API key**: For client-side — limited to read-only operations + enhanced security mode
- **Secret API key**: For server-side — full API access, never expose to client

### 5. Production Email Setup (Knock + Resend)

**Sources**: [Resend Integration](https://docs.knock.app/integrations/email/resend), [Resend Domain Verification](https://resend.com/docs/dashboard/domains/introduction), [Resend Pricing](https://resend.com/pricing), [Resend Rate Limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)

#### Resend Channel Configuration in Knock
| Setting | Required | Notes |
|---------|----------|-------|
| API Key | **Yes** | From Resend dashboard; store per-environment in Knock |
| From email address | **Yes** | Supports Liquid templates; must match verified domain |
| From name | No | Supports Liquid templates |
| Sandbox mode | No | Toggle per-environment; prevents actual delivery |
| Open tracking | No | Per-environment; enable for analytics |
| Link-click tracking | No | Per-environment; enable for analytics |
| Incoming webhooks | No | Enable for delivery status updates from Resend |

#### Delivery Status Webhooks (Resend → Knock)
Setup process:
1. Enable "incoming webhooks" in Knock's Resend channel configuration
2. Copy the generated webhook URL from Knock
3. In Resend dashboard, add a webhook endpoint with that URL
4. Select `email.delivered` and `email.bounced` events
5. Resend auto-verifies the endpoint

**Supported status mappings**:
- `email.delivered` → Knock `delivered` status
- `email.bounced` → Knock `bounced` status

#### Domain Verification (Resend)
- **SPF and DKIM are handled automatically** by Resend when you add a domain
- Add a domain in Resend dashboard → DNS records are provided → add to your DNS provider
- Verification statuses: Not Started → Pending → Verified (or Failed after 72 hours)
- **DMARC**: Resend supports DMARC compliance with strict alignment on DKIM, relaxed on SPF
- **Critical**: "Identity not found" error means your sending domain is not verified in Resend

#### Resend Rate Limits and Quotas

| Tier | Monthly Emails | Daily Limit | Rate Limit | Price |
|------|---------------|-------------|------------|-------|
| Free | 3,000 | 100/day | 2 req/s | $0/mo |
| Pro | 50,000 | — | 2 req/s (upgradeable) | $20/mo |
| Scale | 100,000 | — | 2 req/s (upgradeable) | $90/mo |
| Enterprise | Custom | Custom | Custom | Custom |

- All accounts start at 2 requests/second; contact support for increases
- Pay-as-you-go for overages
- Email alerts at 80% and 100% of quota

#### Knock API Rate Limits
- Each Knock API endpoint is rate limited (tier-based, per-endpoint)
- Rate limit tiers are NOT account/plan-specific
- 429 responses when rate limited
- Batch/bulk endpoints have additional deduplication rate limiting
- **Throttle function** in workflows: limit notification frequency per recipient (e.g., 1 email/hour per alert type)

---

## CI/CD Integration for Knock

**Sources**: [CI/CD Integration](https://docs.knock.app/developer-tools/integrating-into-cicd), [CLI Reference](https://docs.knock.app/cli/overview)

### Recommended GitHub Actions Setup

#### Development Push (Feature Branch)
```yaml
- name: Push Knock Changes
  env:
    KNOCK_SERVICE_TOKEN: ${{ secrets.KNOCK_SERVICE_TOKEN }}
  run: |
    knock workflow push --all --commit
    knock layout push --all --commit
```

#### Staging Promotion (PR Merge to Staging Branch)
```yaml
- name: Promote to Staging
  env:
    KNOCK_SERVICE_TOKEN: ${{ secrets.KNOCK_SERVICE_TOKEN }}
  run: knock commit promote --to=staging --service-token=$KNOCK_SERVICE_TOKEN
```

#### Production Promotion (PR Merge to Main)
```yaml
- name: Promote to Production
  env:
    KNOCK_SERVICE_TOKEN: ${{ secrets.KNOCK_SERVICE_TOKEN }}
  run: knock commit promote --to=production --service-token=$KNOCK_SERVICE_TOKEN
```

### Key CI/CD Notes
- `KNOCK_SERVICE_TOKEN` must be stored as a GitHub secret
- CLI install: `npm install -g @knocklabs/cli`
- Requires Node.js 16.14.0+
- **Critical**: Uncommitted changes pushed to Knock can be overwritten by another user — always commit
- CLI auto-locates promotion-eligible changes based on environment hierarchy in Settings → Environments

---

## Trade-off Analysis: Resend Templates

| Factor | Knock Templates | React Email (Codebase) |
|--------|----------------|----------------------|
| **Developer Experience** | Dashboard visual/code editor + Liquid | React components + TypeScript + full IDE support |
| **Version Control** | CLI pull/push; can diverge from dashboard edits | Native Git workflow; PR reviews |
| **Preview/Testing** | Dashboard preview pane + test runner | Browser dev server; unit testable |
| **Batch Support** | Native variables: `activities`, `total_activities` | Must manually aggregate and pass data |
| **Rollback** | Dashboard commit revert (promoted through environments) | Standard Git revert |
| **Preference Integration** | Automatic — templates only render if allowed | Must re-implement preference checking |
| **Non-Dev Editing** | Yes — visual editor accessible to anyone | No — requires code changes + deploy |
| **Email Client Compat** | Auto CSS inlining by Knock | Must handle via React Email components |
| **Multi-Channel Parity** | Same system for email, push, in-app | Separate systems per channel |
| **Template Complexity** | Limited to Liquid syntax | Full React/JSX expressiveness |

**Verdict**: Use Knock templates for notification emails. The batch variable integration, automatic preference checking, and multi-channel parity far outweigh React Email's developer experience advantages for this use case.

---

## Sources

### Knock Official Documentation
- [Going to Production](https://docs.knock.app/getting-started/going-to-production) - Knock Docs
- [Environments](https://docs.knock.app/concepts/environments) - Knock Docs
- [Commits](https://docs.knock.app/concepts/commits) - Knock Docs
- [Security and Authentication](https://docs.knock.app/in-app-ui/security-and-authentication) - Knock Docs
- [Security at Knock](https://docs.knock.app/security) - Knock Docs
- [Resend Integration](https://docs.knock.app/integrations/email/resend) - Knock Docs
- [Email Settings and Overrides](https://docs.knock.app/integrations/email/settings) - Knock Docs
- [Email Layouts](https://docs.knock.app/integrations/email/layouts) - Knock Docs
- [Template Editor](https://docs.knock.app/designing-workflows/template-editor) - Knock Docs
- [Batch Function](https://docs.knock.app/designing-workflows/batch-function) - Knock Docs
- [Throttle Function](https://docs.knock.app/designing-workflows/throttle-function) - Knock Docs
- [MCP Server](https://docs.knock.app/developer-tools/mcp-server) - Knock Docs
- [Agent Toolkit](https://docs.knock.app/developer-tools/agent-toolkit/overview) - Knock Docs
- [Management API](https://docs.knock.app/developer-tools/management-api) - Knock Docs
- [CLI Reference](https://docs.knock.app/cli/overview) - Knock Docs
- [CI/CD Integration](https://docs.knock.app/developer-tools/integrating-into-cicd) - Knock Docs
- [Channels](https://docs.knock.app/concepts/channels) - Knock Docs
- [Implementation Guide](https://docs.knock.app/tutorials/implementation-guide) - Knock Docs
- [Knock CLI Blog Post](https://knock.app/blog/announcing-knock-cli) - Knock Blog

### Knock Agent Toolkit
- [Agent Toolkit GitHub](https://github.com/knocklabs/agent-toolkit) - knocklabs
- [Agent Toolkit NPM](https://www.npmjs.com/package/@knocklabs/agent-toolkit) - NPM
- [MCP Server Announcement](https://knock.app/blog/announcing-agent-toolkit-and-mcp-server) - Knock Blog

### Resend
- [Resend Domain Verification](https://resend.com/docs/dashboard/domains/introduction) - Resend Docs
- [Resend Email Authentication Guide](https://resend.com/blog/email-authentication-a-developers-guide) - Resend Blog
- [Resend Account Quotas and Limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits) - Resend Docs
- [Resend Pricing](https://resend.com/pricing) - Resend, 2026
- [React Email](https://react.email/) - React Email, 2026
- [React Email 5.0](https://resend.com/blog/react-email-5) - Resend Blog, 2025

---

## Open Questions

1. **What Knock plan/tier is Lightfast on?** — Rate limits, batch rendering limits (10 vs 100 activities), and throttle capabilities may differ by plan. Enterprise plan allows configuring activity rendering limit up to 100.

2. **Has the sending domain been verified in Resend?** — Required for production email delivery. "Identity not found" errors indicate missing domain verification.

3. **Are Resend delivery status webhooks configured?** — These provide `delivered`/`bounced` tracking in Knock but require manual setup in both Knock and Resend dashboards.

4. **Is enhanced security mode needed for Phase 2?** — Enhanced security is for in-app UI (real-time feed). If Phase 2 is email-only (no in-app notifications), enhanced security mode can be deferred.

5. **Should CI/CD promotion be automated?** — The CLI supports `knock commit promote --to=production` in GitHub Actions, but this requires storing a `KNOCK_SERVICE_TOKEN` secret and setting up the pipeline.

6. **What is the expected email volume?** — Resend free tier limits to 100 emails/day. Production notification volume will determine if Pro tier ($20/mo) is needed.

7. **Are there multiple Knock environments configured?** — If only Development and Production exist, promotion is direct. If a Staging environment was added, promotion follows Development → Staging → Production.
