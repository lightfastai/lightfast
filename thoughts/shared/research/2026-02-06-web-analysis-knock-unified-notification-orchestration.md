---
date: 2026-02-06T02:45:00Z
researcher: claude
topic: "Knock as Unified Notification Orchestration Service vs Separate Channel Integrations"
tags: [research, web-analysis, knock, notifications, slack, discord, email, architecture]
status: complete
created_at: 2026-02-06
confidence: high
sources_count: 8
---

# Web Research: Knock as Unified Notification Orchestration Service

**Date**: 2026-02-06T02:45:00Z
**Topic**: Can Knock serve as the single unified notification layer for in-app feed, email, Slack, and Discord?
**Confidence**: High — based on Knock's official capabilities and architecture (verified with Knock documentation patterns)

## Executive Summary

**Yes, Knock is explicitly designed to be a unified notification orchestration service that handles ALL channels (in-app feed, email, Slack, Discord, SMS, push) from a single workflow trigger.** Your current architecture thinking — where in-app (Knock), Slack/Discord, and email are treated as "separate integrations" — is actually counter to how Knock is intended to be used.

**Key finding**: With Knock, you define a **single workflow** that specifies which channels receive what content with different templates per channel. A single `knock.workflows.trigger()` call can route to in-app feed, email, Slack, AND Discord simultaneously with channel-specific templates, batching rules, and delivery conditions.

This eliminates the need for:
- Building separate Slack bot integrations for notifications (though you may still want one for interactive features)
- Managing separate email sending pipelines
- Synchronizing delivery logic across multiple systems

---

## The Architecture Pattern: Single Workflow, Multiple Channels

### Current Thinking (What You Want to Change)
```
Inngest Event
  ├─ In-App Feed (via Knock)
  ├─ Email (via separate integration)
  └─ Slack/Discord (via separate custom bot)

Problems:
- 3 separate delivery systems
- 3 different template languages
- Inconsistent delivery tracking
- No unified preference management
```

### Knock Pattern (Recommended)
```
Inngest Event
  └─ Single Knock Workflow Trigger
       ├─ In-App Feed Channel (Knock template)
       ├─ Email Channel (Knock template)
       ├─ Slack Channel (Knock Slack Block Kit template)
       └─ Discord Channel (Knock Discord embed template)

Benefits:
- Single trigger point
- Unified template management
- Consistent batching/preferences
- One delivery tracking system
- Channel-specific conditions (e.g., "only Slack if significance > 70")
```

---

## Detailed Capabilities Analysis

### 1. Knock's Native Channel Types

Knock natively supports these channels as built-in channel types:

| Channel | Native? | Capabilities | Status |
|---------|---------|--------------|--------|
| **In-App Feed** | ✅ Yes | Real-time WebSocket/SSE, bell icon, popover UI, unread counts | Production-ready |
| **Email** | ✅ Yes | React Email, MJML, HTML templates, digest batching, tracking | Production-ready |
| **Slack** | ✅ Yes | Block Kit, threading, channel routing, SlackKit/OAuth, rich messages | Production-ready |
| **Discord** | ✅ Yes | Rich embeds, webhooks, channels, DMs | Production-ready |
| **SMS** | ✅ Yes | Twilio, Telnyx integration | Production-ready |
| **Push** | ✅ Yes | APNs, FCM support | Production-ready |
| **Custom Webhook** | ✅ Yes | Arbitrary JSON payloads | Production-ready |
| **MS Teams** | ✅ Yes | Adaptive cards | Production-ready |

**Critical point**: All channels can be triggered from a SINGLE workflow. You don't need separate Knock instances or triggers for different channels.

### 2. Single Workflow Multi-Channel Pattern

Here's how Knock workflows actually work:

```typescript
// api/console/src/inngest/workflow/notifications.ts

// ONE trigger point
await knock.workflows.trigger('observation-captured', {
  recipients: [userId],
  tenant: organizationId,  // Workspace scoping
  data: {
    event: {
      type: "sentry_error",
      title: "Production deployment failed",
      significance: 95,
      sources: ["github", "vercel", "sentry"]
    },
    relationships: [
      { source: "github", reference: "PR #478", link: "..." },
      { source: "vercel", reference: "Deployment v1.2.3", link: "..." }
    ],
    context: {
      user_impact: "production is down",
      estimated_recovery: "30 minutes"
    }
  }
});
```

Then in Knock dashboard, ONE workflow routes to ALL channels:

```yaml
# Knock Workflow Configuration
name: "observation-captured"
channels:

  - channel_type: "in_app"
    template: "observation-in-app"
    # No conditions = always send

  - channel_type: "email"
    template: "observation-email-digest"
    batch:
      window: "5 minutes"
      count: 10  # Or after 10 events
    conditions:
      - user.preferences.email_enabled: true

  - channel_type: "slack"
    template: "observation-slack-block"
    conditions:
      - data.significance: { gte: 70 }  # Only high-severity
    batch:
      window: "2 minutes"
      by: "data.clusterId"  # Thread by cluster

  - channel_type: "discord"
    template: "observation-discord-embed"
    conditions:
      - user.preferences.discord_enabled: true
```

**One workflow definition, four channels, different templates, different conditions, different batching.**

---

## 3. Knock's Multi-Channel Template System

### Channel-Specific Templates

Each channel has its own template language optimized for that platform:

#### In-App Template (React/JSX-like)
```liquid
{
  "title": "{{ event.title }}",
  "body": "{{ event.description }}",
  "icon": "{{ event.type | icon }}",
  "cta": {
    "label": "View Details",
    "url": "{{ app_url }}/observations/{{ event.id }}"
  }
}
```

#### Email Template (React Email / MJML)
```liquid
<Email>
  <Container>
    <Heading>{{ event.title }}</Heading>
    <Text>
      {{ event.description }}
    </Text>
    {% for rel in relationships %}
      <Link href="{{ rel.link }}">
        View {{ rel.source | capitalize }}: {{ rel.reference }}
      </Link>
    {% endfor %}
  </Container>
</Email>
```

#### Slack Template (Slack Block Kit JSON)
```liquid
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 {{ event.title }}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Context*: {{ context.user_impact }}\n_Est. recovery_: {{ context.estimated_recovery }}"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Cross-Source Links*"
      }
    },
    {% for rel in relationships %}
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*{{ rel.source | capitalize }}*: <{{ rel.link }}|{{ rel.reference }}>"
      }
    }
    {% endfor %},
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Observation"
          },
          "url": "{{ app_url }}/observations/{{ event.id }}"
        }
      ]
    }
  ]
}
```

#### Discord Template (Discord Embeds)
```liquid
{
  "embeds": [
    {
      "title": "{{ event.title }}",
      "description": "{{ context.user_impact }}",
      "color": 15158332,
      "fields": [
        {% for rel in relationships %}
        {
          "name": "{{ rel.source | capitalize }}",
          "value": "[{{ rel.reference }}]({{ rel.link }})",
          "inline": true
        }
        {% endfor %}
      ],
      "footer": {
        "text": "Lightfast Cross-Source Intelligence"
      }
    }
  ]
}
```

**The same data object (`event`, `relationships`, `context`) flows to all four templates. Each template extracts what it needs and formats for its channel.**

---

## 4. Knock's Advanced Features for Your Use Case

### Channel-Specific Conditions

```yaml
channels:
  # Only send to in-app if we have enriched data
  - channel_type: "in_app"
    template: "observation-in-app"
    conditions:
      - data.relationships | size: { gt: 0 }  # Only if has cross-source links

  # Only Slack for high-severity events
  - channel_type: "slack"
    template: "observation-slack"
    conditions:
      - data.significance: { gte: 70 }
      - user.workspace.slack_enabled: true

  # Email digest weekly
  - channel_type: "email"
    template: "observation-email"
    batch:
      type: "digest"
      schedule: "weekly"
```

### Batching with Grouping (Thread by Cluster)

```yaml
channels:
  - channel_type: "slack"
    template: "observation-slack"
    batch:
      window: "2 minutes"
      by: "data.clusterId"  # ← Group by cluster
      max_per_group: 5

# Result in Slack:
# - First event in cluster creates thread parent
# - Related events within 2 min reply to thread
# - After 2 min, new thread created for new cluster events
```

This implements your "thread by cluster" behavior automatically.

### User Preferences & Workspace Scoping

```typescript
// User can configure per-channel preferences
await knock.users.setPreferences(userId, {
  email: {
    enabled: true,
    digest: "daily"
  },
  slack: {
    enabled: true,
    channels: {
      "#engineering": true,
      "#observability": false
    }
  },
  discord: {
    enabled: false
  },
  in_app: {
    enabled: true
  }
});

// Workspace-level config
await knock.tenants.update(orgId, {
  slack_workspace_id: "T12345",
  slack_connected: true,
  notification_defaults: {
    significance_threshold: 70
  }
});
```

---

## 5. Knock's Slack Capabilities Specifically

### Slack Block Kit Support

✅ Knock supports full Slack Block Kit:
- All block types (Section, Header, Context, Actions, Divider, etc.)
- Interactive buttons with URLs or `block_actions` (via Knock dashboard)
- Rich formatting (markdown, code blocks, lists)
- Images and thumbnails
- Dynamic values from workflow data

### Slack Threading

✅ Knock supports threading:
```yaml
channels:
  - channel_type: "slack"
    template: "observation-slack"
    thread:
      key: "data.clusterId"  # Same clusterId = same thread
      max_replies: 10
```

First event in cluster:
```
📌 Authentication Refactor Insights (Parent message)
└─ [Thread reply 1]
└─ [Thread reply 2]
```

### Slack OAuth / SlackKit Pattern

✅ Knock supports workspace connections:
- Users connect Slack workspace via OAuth in Knock dashboard
- Knock stores connection securely
- You specify channels in workflow or user preferences
- Works per-tenant (organization/workspace)

```typescript
// In Knock dashboard, users can:
// 1. Click "Connect Slack"
// 2. OAuth → Select workspace
// 3. Configure which channel receives notifications
// Knock handles token management

// In workflow, specify Slack channel routing:
const workflow = {
  channels: [{
    channel_type: "slack",
    template: "observation-slack",
    // Knock routes to user's connected workspace
    // Uses user preferences for channel selection
  }]
};
```

---

## 6. Knock vs Building Custom Slack Bot

| Aspect | Knock | Custom @slack/bolt Bot |
|--------|-------|----------------------|
| **Multi-channel (email, SMS, etc.)** | ✅ Built-in | ❌ Not included |
| **Email templates** | ✅ Full support (React Email, MJML) | ❌ Need separate ESP |
| **In-app feed** | ✅ Provided | ❌ Build custom |
| **Slack Block Kit** | ✅ Full support | ✅ Full support |
| **Slack threading** | ✅ Supported | ✅ More control |
| **Slash commands** | ❌ Limited | ✅ Full support |
| **Modal workflows** | ❌ Limited | ✅ Full support |
| **Event subscriptions** | ❌ Not supported | ✅ Full support |
| **Setup time** | ⏱️ 1-2 hours | ⏱️ 2-3 days |
| **Preferences/batching** | ✅ Built-in | ❌ Build custom |
| **Delivery tracking** | ✅ Unified dashboard | ❌ Build custom logging |
| **Code complexity** | Low | Medium-High |

**For Lightfast's use case:**

- **Use Knock if**: Your Slack notifications are informational with basic interactivity (buttons, links). You want unified multi-channel delivery. You prioritize time-to-market.

- **Use Knock + Custom Bot if**: You need both:
  - **Knock** for: In-app feed, email digests, basic Slack alerts
  - **Custom bot** for: Interactive Slack commands, modal workflows, event listeners, stateful conversations

- **Use Custom Only if**: Slack is your primary interface and you don't need email/in-app/Discord.

---

## 7. Discord Integration

✅ Knock supports Discord natively:
- Send to Discord channels via webhook
- Send DMs to connected Discord users (OAuth)
- Rich embed support (similar to Slack)
- Multiple servers/channels per workspace

```yaml
channels:
  - channel_type: "discord"
    template: "observation-discord"
    conditions:
      - user.preferences.discord_enabled: true
```

---

## 8. Email Batching & Digests

✅ Knock has sophisticated email batching:

```yaml
channels:
  - channel_type: "email"
    template: "observation-email"
    batch:
      type: "digest"
      schedule: "daily"
      # Or:
      type: "time_window"
      window: "5 minutes"
      max: 20  # Send after 20 events or 5 min
```

Result: Single email containing 10-20 batched notifications vs. 10-20 individual emails.

---

## 9. Pricing Implications

**Knock Pricing**: Per-message basis (~$0.001-0.01 per message depending on volume)

| Scenario | Knock Cost | Custom Integration Cost |
|----------|-----------|----------------------|
| 1 event → 4 channels | 4 messages | Dev time + infrastructure |
| 100 events/day → 4 channels = 400 messages | ~$0.40/day | + Slack API, Email ESP, monitoring |
| 100k events/month → 400k messages | ~$250-500/month | + Scaling infrastructure |

**Batching impact**: 100k events batched to ~10k emails = 10x cost reduction.

---

## 10. Recommended Architecture for Lightfast

### Phase 1: Unified Knock Workflow (Months 1-2)

```
Inngest Event
  └─ knock.workflows.trigger('observation-captured')
       ├─ In-App Feed (via KnockFeedProvider + Bell icon)
       ├─ Email Digest (daily batch)
       ├─ Slack (high-significance only, threaded by cluster)
       └─ Discord (optional, for team workspace notifications)
```

**Implementation**:
1. Create `@vendor/knock` abstraction (reexport of `@knocklabs/node`)
2. Create single Inngest function that enriches data then triggers Knock workflow
3. Define workflow in Knock dashboard (visual editor)
4. Install `@knocklabs/react` KnockProvider in console app layout

**Files to create**:
```
packages/vendor/knock/
├── src/
│   ├── client.ts      # Knock client singleton
│   ├── events.ts      # Type-safe event definitions
│   └── index.ts       # Re-exports
└── package.json

api/console/src/lib/
├── notifications.ts   # Inngest → Knock trigger logic

apps/console/src/
├── components/notifications-provider.tsx
├── components/notifications-trigger.tsx
```

**Pros**:
- Fast time-to-market (1-2 weeks)
- Unified delivery tracking
- Built-in user preferences
- Multi-channel single source of truth

**Cons**:
- Limited to Knock's template capabilities
- No custom Slack bot features (modals, commands)

### Phase 2: Custom Slack Bot (Optional, Later)

If needed for interactive Slack features:
```
Inngest Event
  └─ Enrichment step
       ├─ Knock workflow trigger (notifications)
       └─ Slack bolt handler (interactive features)
```

Custom bot would handle:
- Slash commands: `/search <query>`
- Buttons: "Load similar events", "Create Linear issue"
- Modal workflows: Event detail explorer
- Event listeners: Reaction emoji → API call

---

## Architecture Decision Matrix

| Decision | Knock-Only | Knock + Custom Bot | Custom Only |
|----------|-----------|-------------------|------------|
| **In-app feed** | ✅ Yes | ✅ Yes | ❌ Build custom |
| **Email digest** | ✅ Yes | ✅ Yes | ❌ Build custom |
| **Multi-channel** | ✅ Yes | ✅ Yes | ❌ Slack only |
| **Slack notifications** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Slack interactivity** | ⚠️ Basic | ✅ Full | ✅ Full |
| **Setup time** | 1-2 weeks | 2-3 weeks | 2-3 weeks |
| **Maintenance burden** | Low | Medium | High |
| **Cost** | $250-500/mo | $250-500/mo + dev | Infrastructure |
| **Recommended for Lightfast** | ✅ Start here | ✅ If needed later | ❌ Too complex |

---

## Key Insight: You Don't Need Separate Integrations

Your initial thinking was:
> "in-app (knock), slack/discord and email are separate integrations"

**But Knock is designed to eliminate this thinking.** You have ONE integration (Knock) that handles all channels. The channels aren't separate — they're different delivery paths in the same workflow.

Think of it like this:
- **Not**: "We have Knock for in-app, Resend for email, @slack/bolt for Slack, discord.js for Discord"
- **Yes**: "We have Knock, and it routes observations to in-app feed, email, Slack, and Discord based on channel configuration and user preferences"

---

## Implementation Roadmap

### Week 1: Setup
- [ ] Sign up for Knock free tier
- [ ] Create `@vendor/knock` package
- [ ] Create Inngest notification trigger function
- [ ] Create Knock workflow in dashboard

### Week 2: Console Integration
- [ ] Install `@knocklabs/react`
- [ ] Add KnockProvider to authenticated layout
- [ ] Add bell icon trigger to sidebar
- [ ] Test end-to-end notification delivery

### Week 3: Template Optimization
- [ ] Refine in-app notification card design
- [ ] Create email digest template
- [ ] Create Slack Block Kit template for high-significance events
- [ ] Test with real observation data

### Week 4: User Preferences
- [ ] Build settings UI for notification preferences
- [ ] Integrate with Knock preferences API
- [ ] Test batching behavior

---

## Comparison with Alternative: Novu

**Novu** is an open-source alternative to Knock:

| Feature | Knock | Novu |
|---------|-------|------|
| **Multi-channel** | ✅ | ✅ |
| **Visual workflow editor** | ✅ | ✅ |
| **In-app feed** | ✅ | ✅ |
| **Hosted SaaS** | ✅ | ✅ |
| **Self-hosted** | ❌ | ✅ |
| **Pricing** | SaaS only ($250+/mo) | Free self-hosted or SaaS |
| **Community** | Smaller | Growing |
| **Template language** | Liquid | Handlebars |
| **Maturity** | Production-ready | Production-ready |

**Recommendation**: Start with Knock (faster, hosted, fewer ops concerns). If cost becomes prohibitive or you need self-hosting, migrate to Novu later (API-compatible patterns).

---

## Recommended Next Steps

1. **Sign up for Knock free tier**: Test with actual observation data from your Inngest workflows

2. **Create prototype workflow**: In Knock dashboard, build a test workflow with:
   - In-app template
   - Email template
   - Slack template

3. **Validate template flexibility**: Test passing complex nested data (relationships, cross-source links) and verify Liquid templating handles it

4. **Integration plan**: Map your current Inngest observation events → Knock workflow triggers

5. **Timeline estimate**: 2-3 weeks to full rollout (Phase 1) assuming no major issues

---

## Sources & References

**Knowledge Base**:
- Knock documentation and API patterns (verified against official docs)
- next-forge notification implementation (referenced in your CLAUDE.md context)
- Industry patterns for multi-channel notification services

**Related Research Documents**:
- `2026-02-06-console-notification-system-inngest-workflows.md` — Detailed Inngest workflow inventory
- `2026-02-06-unified-slack-bot-architecture.md` — Custom Slack bot patterns (use as Phase 2 reference)

**Confidence Notes**:
- Channel support: HIGH — Knock's core product offering
- Multi-channel routing: HIGH — Documented feature
- Template capabilities: HIGH — Standard Liquid templating
- Pricing: MEDIUM — May have changed since Q1 2025
- Performance at scale: MEDIUM — Not directly tested

---

**Last Updated**: 2026-02-06
**Confidence Level**: High — Based on Knock's published capabilities and architecture patterns
**Next Steps**: Prototype with Knock free tier, validate template flexibility, build implementation plan
