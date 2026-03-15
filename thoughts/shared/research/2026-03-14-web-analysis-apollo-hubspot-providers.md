---
date: 2026-03-14T14:00:00+11:00
researcher: claude-sonnet-4-6
topic: "Apollo.io + HubSpot Provider Integration Research for Lightfast"
tags: [research, web-analysis, apollo, hubspot, providers, gtm, crm, sales-intelligence]
status: complete
created_at: 2026-03-14
confidence: high
sources_count: 35
---

# Web Research: Apollo.io + HubSpot as Lightfast Providers

**Date**: 2026-03-14
**Topic**: Developer-level API research for building Apollo and HubSpot provider integrations
**Confidence**: High — sourced from official API docs, changelogs, and verified community reports

---

## Executive Summary

**HubSpot** is the stronger first provider: full OAuth2, native webhook subscriptions with HMAC verification, cursor-based pagination, and a clean v3 CRM API covering contacts, companies, deals, tickets, and engagements. It maps directly to Lightfast's existing provider architecture (relay webhook receiver → transform → entity store).

**Apollo** is architecturally different: **no native outbound webhooks** for CRM events. All engagement data (email opens, clicks, replies, bounces) must be polled via search endpoints. OAuth2 is partner-only. However, Apollo's enrichment data (firmographics, technographics, funding, job changes) is uniquely valuable for the entity graph — it adds signal that no other provider carries.

**Recommendation**: Build HubSpot first (webhook-native, clean fit). Build Apollo second as a polling + enrichment provider. Together they create the eng↔GTM entity graph that is Lightfast's differentiation.

---

## Apollo.io — Provider Architecture

### Authentication

| Method | Type | Notes |
|---|---|---|
| API Key | `x-api-key` header | Two tiers: standard (limited) and master (required for most writes). All plans. |
| OAuth2 | Authorization Code | **Partner-only** — requires app registration. Not available to direct customers. |

**OAuth2 Flow** (when registered as partner):
- Authorization URL: Revealed post-registration
- Token URL: `https://api.apollo.io/oauth/token` (inferred)
- Scopes: `read_user_profile`, `app_scopes` (auto-added), plus custom scopes
- Refresh tokens issued; exact TTL undocumented
- Users need "Can authorize third-party apps/integrations via OAuth" permission

**For Lightfast**: Start with API key auth via gateway. Pursue OAuth partner registration for marketplace listing later.

### Base URL & Pagination

- **Base URL**: `https://api.apollo.io/api/v1`
- **Pagination**: Page-number based (`page` + `per_page`, max 100/page)
- **Hard cap**: 50,000 records per search (500 pages × 100). Must segment by date/filters for larger datasets.
- **No cursor-based pagination** — page numbers only.

### Rate Limits

Fixed-window strategy: per-minute, per-hour, per-day. Plan-dependent, not publicly published.

Check live limits via:
```
POST /api/v1/usage_stats/api_usage_stats
```

Community-reported: ~200 req/min for search endpoints on paid plans. Bulk enrichment throttled to 50% of single-record limits.

### Webhooks — Critical Constraint

**Apollo does NOT have general-purpose outbound webhooks.**

The only webhook mechanism is the **waterfall enrichment callback**: when you call `/api/v1/people/match` with `run_waterfall_email: true` and provide a `webhook_url`, Apollo posts enriched data back asynchronously. This is a per-request callback, not a subscription.

**No push events for**: contact.created, contact.updated, sequence enrollment/completion, email sent/opened/clicked/replied/bounced, deal stage changes, task completion.

**Implication for Lightfast**: Apollo must be a **polling provider**. The backfill service polls Apollo's search endpoints on a schedule, transforms results into entities, and detects state transitions by diffing against stored entity state.

### Core Resources

#### People/Contacts

| Operation | Endpoint | Credits |
|---|---|---|
| Search your contacts | `POST /contacts/search` | Free |
| View contact | `GET /contacts/{id}` | Free |
| Create contact | `POST /contacts` | Free |
| Bulk create | `POST /contacts/bulk_create` | Free |
| Search Apollo's people DB | `POST /mixed_people/search` | Yes |
| People enrichment | `POST /people/match` | Yes |
| Bulk enrichment (10) | `POST /people/bulk_match` | Yes |

Key fields: `id`, `first_name`, `last_name`, `email`, `email_status`, `phone_numbers[]`, `title`, `headline`, `linkedin_url`, `twitter_url`, `github_url`, `organization_id`, `account_id`, `contact_stage_id`, `label_ids[]`, `owner_id`, `seniority`, `departments[]`, `employment_history[]`

Contact stages: Cold, Approaching, Replied, Interested, Not Interested, Unresponsive, Do Not Contact.

#### Organizations/Accounts

| Operation | Endpoint | Credits |
|---|---|---|
| Search your accounts | `POST /accounts/search` | Free |
| Create account | `POST /accounts` | Free |
| Bulk create (100) | `POST /accounts/bulk_create` | Free |
| Org enrichment | `GET /organizations/enrich?domain=` | Yes |
| Bulk org enrichment (10) | `POST /organizations/bulk_enrich` | Yes |

Enrichment fields: `name`, `website_url`, `linkedin_url`, `industry`, `estimated_num_employees`, `annual_revenue`, `founded_year`, `technology_names[]`, `funding_events[]` (amount, date, type, investors), `short_description`

#### Sequences (internally: `emailer_campaigns`)

| Operation | Endpoint |
|---|---|
| Search sequences | `POST /emailer_campaigns/search` |
| Add contacts to sequence | `POST /emailer_campaigns/{id}/add_contact_ids` |
| Search sent emails | `GET /emailer_messages/search` |
| Email stats per message | `GET /emailer_messages/{id}/activities` |

Contact status in sequence: `active`, `finished`, `removed`.

Email activities (opens, clicks, replies, bounces) are accessible only via polling `/emailer_messages/search` + per-email `/emailer_messages/{id}/activities`.

#### Deals (internally: `opportunities`)

| Operation | Endpoint |
|---|---|
| Search deals | `GET /opportunities/search` |
| Create deal | `POST /opportunities` |
| Update deal | `PATCH /opportunities/{id}` |
| List stages | `GET /opportunity_stages` |

Fields: `id`, `owner_id`, `account_id`, `opportunity_stage_id`, `amount`, `is_closed`, `is_won`, `close_date`

### Known Gotchas

1. **Master API key required** for most write operations — standard key returns 403
2. **50k record search cap** — must segment queries for larger datasets
3. **People Search ≠ Contact Search**: `/mixed_people/search` (Apollo DB, costs credits, no emails) vs `/contacts/search` (your data, free)
4. **Deduplication off by default** — `run_dedupe: false` on API-created contacts
5. **Internal naming mismatch**: Sequences = `emailer_campaigns`, Steps = `emailer_touches`, Emails = `emailer_messages`
6. **Organization ID oscillation**: Known bug where `organization_id` can flip between values due to matching algorithm edge case
7. **No bulk update for contacts** — must PATCH individually

### Pricing & Credits

| Plan | $/user/mo (annual) | Email Credits | Mobile Credits | Data Credits/yr |
|---|---|---|---|---|
| Free | $0 | 10,000/mo | 5/mo | 1,200 |
| Basic | $49 | Unlimited | 75/mo | 5,000 |
| Professional | $79 | Unlimited | 100/mo | 10,000 |
| Organization | $119 (min 3) | Unlimited | 120/mo | 15,000 |

Credit-consuming endpoints: people/org enrichment, org search, org details, job postings, news articles. All CRUD on contacts/accounts/sequences/deals/tasks is credit-free.

---

## HubSpot — Provider Architecture

### Authentication

| Method | Type | Notes |
|---|---|---|
| OAuth2 | Authorization Code | Full public app flow. Multi-tenant. Required for marketplace. |
| Private App Token | Static Bearer | Single-account only. No expiry. No webhook API access. |

**OAuth2 Flow**:
- **Authorization URL**: `https://app.hubspot.com/oauth/authorize?client_id={ID}&scope={SCOPES}&redirect_uri={URI}`
- **Token URL**: `https://api.hubapi.com/oauth/v1/token` (v3 endpoint also available: `/oauth/v3/token`)
- **Grant type**: Authorization Code
- **Access token TTL**: Short-lived (use `expires_in` from response — reported 30min to 6hrs, treat as opaque)
- **Refresh tokens**: Long-lived, no documented expiry. Invalidated on app uninstall.
- **Token refresh**: Standard refresh_token grant with client_id + client_secret

**Required scopes for CRM integration**:
```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.companies.write
crm.objects.deals.read
crm.objects.deals.write
tickets
crm.objects.owners.read
crm.pipelines.orders.read
sales-email-read
oauth
```

### Base URL & Pagination

- **Base URL**: `https://api.hubapi.com`
- **API version**: v3 (current canonical), v4 for Associations
- **Pagination**: Cursor-based via `after` token
- **Page size**: `limit` param, max 100 for list endpoints, max 200 for search
- **End signal**: absence of `paging.next` in response

### Rate Limits

| Context | Burst (10s rolling) | Daily |
|---|---|---|
| Public OAuth app | 110 req/10s per app per account | No documented cap |
| Private app (Free/Starter) | 100 req/10s | 250,000 |
| Private app (Professional) | 190 req/10s | 650,000 |
| Private app (Enterprise) | 190 req/10s | 1,000,000 |

Rate limits are per-app, per-installed-account for OAuth apps. HTTP 429 with `Retry-After` header.

### Webhooks — Full Native Support

**This is HubSpot's strongest fit with Lightfast's architecture.**

#### Configuration

Webhooks are configured at the **app level** via the Webhooks API:

```
PUT /webhooks/v3/{appId}/settings
{
  "targetUrl": "https://relay.lightfast.ai/webhook/hubspot",
  "throttling": { "period": "SECONDLY", "maxConcurrentRequests": 10 }
}

POST /webhooks/v3/{appId}/subscriptions
{
  "eventType": "deal.propertyChange",
  "propertyName": "dealstage",
  "active": true
}
```

Uses **developer API key** for webhook management (not OAuth token).

#### Available Event Types

| Event | Object |
|---|---|
| `contact.creation` / `.deletion` / `.propertyChange` / `.privacyDeletion` | Contact |
| `company.creation` / `.deletion` / `.propertyChange` | Company |
| `deal.creation` / `.deletion` / `.propertyChange` | Deal |
| `ticket.creation` / `.deletion` / `.propertyChange` | Ticket |
| `conversation.creation` / `.newMessage` / `.propertyChange` | Conversation |

New platform types: `object.creation`, `object.propertyChange`, `object.deletion`, `object.associationChange` — using `objectType` param for any CRM object type including engagements.

**Property-level subscriptions**: Subscribe to changes on a specific property (e.g., only `dealstage` changes) by including `propertyName`.

#### Payload Structure

HubSpot sends **batched JSON arrays** (up to 100 events per POST):

```json
[
  {
    "eventId": 930654971,
    "subscriptionId": 210178,
    "portalId": 6205670,
    "appId": 207344,
    "occurredAt": 1575656726200,
    "subscriptionType": "deal.propertyChange",
    "attemptNumber": 0,
    "objectId": 1148387968,
    "changeSource": "CRM_UI",
    "propertyName": "dealstage",
    "propertyValue": "1175058"
  }
]
```

**Critical**: Payloads are minimal — only `objectId` + changed property. Must fetch full record state via API callback.

#### HMAC Verification

HubSpot sends `X-HubSpot-Signature-v3` header. Verification:

1. Reject if `X-HubSpot-Request-Timestamp` > 5 minutes old
2. Construct: `{METHOD}{URI}{BODY}{TIMESTAMP}`
3. HMAC-SHA256 with app's **client secret**
4. Base64-encode, constant-time compare

Also sends legacy `X-HubSpot-Signature` (v1: SHA-256 hash of `clientSecret + body`, hex-encoded).

#### Delivery Guarantees

| Property | Value |
|---|---|
| Semantics | At-least-once |
| Batch size | Up to 100 events/POST |
| Response timeout | 5 seconds |
| Retries | 10 attempts over 24 hours |
| Ordering | Not guaranteed |

**PropertyChange storm**: Creating a contact with 10 properties fires 1 creation event + 10 propertyChange events. Deduplicate on `eventId`.

### Core Resources

All follow the same pattern: `/crm/v3/objects/{objectType}`

#### Contacts

- **Dedup key**: `email` (auto-merges on collision)
- **Lifecycle stages**: subscriber → lead → MQL → SQL → opportunity → customer → evangelist
- Default properties: `createdate`, `email`, `firstname`, `lastname`, `hs_object_id`, `lastmodifieddate`

#### Companies

- **Dedup key**: `domain` (soft — suggests merge, doesn't auto-merge)
- Key fields: `name`, `domain`, `industry`, `annualrevenue`, `numberofemployees`, `city`, `country`

#### Deals

- Key fields: `dealname`, `dealstage` (stage ID string), `pipeline` (pipeline ID), `amount`, `closedate`
- Stages have `metadata.probability` (0.0–1.0) and `metadata.isClosed`
- Multiple pipelines require Starter+

#### Tickets

- Key fields: `subject`, `content`, `hs_pipeline`, `hs_pipeline_stage`, `hs_ticket_priority` (LOW/MEDIUM/HIGH/URGENT)

#### Engagements (v3 — each is its own CRM object)

| Type | Endpoint | Type ID |
|---|---|---|
| Calls | `/crm/v3/objects/calls` | `0-48` |
| Emails | `/crm/v3/objects/emails` | `0-49` |
| Meetings | `/crm/v3/objects/meetings` | `0-47` |
| Notes | `/crm/v3/objects/notes` | `0-46` |
| Tasks | `/crm/v3/objects/tasks` | — |

All require `hs_timestamp`. All support CRUD + batch + search + associations.

### Associations (v4)

```
PUT /crm/v4/objects/{fromType}/{fromId}/associations/{toType}/{toId}
POST /crm/v4/associations/{fromType}/{toType}/batch/read   // max 1000 IDs
```

Key association type IDs: Contact→Company: 1, Contact→Deal: 4, Company→Deal: 5, Contact→Ticket: 16.

v4 adds **labeled associations** (e.g., "Decision Maker", "Primary Contact") — Professional+.

### Search API

```
POST /crm/v3/objects/{objectType}/search
```

- Max 3 filterGroups (OR'd), max 3 filters each (AND'd within group) = 9 total conditions
- Operators: EQ, NEQ, LT, LTE, GT, GTE, BETWEEN, IN, NOT_IN, HAS_PROPERTY, CONTAINS_TOKEN
- Max 200 results/page, **10,000 total hard cap** — must segment by `lastmodifieddate` for larger datasets
- Separate stricter rate limit from general API

### Batch Operations

```
POST /crm/v3/objects/{objectType}/batch/create   // 100 records max
POST /crm/v3/objects/{objectType}/batch/read
POST /crm/v3/objects/{objectType}/batch/update
POST /crm/v3/objects/{objectType}/batch/upsert
```

**Upsert gotcha**: `email` is NOT treated as unique for batch upsert. Must use `hs_object_id` or a custom property marked as unique.

### Known Gotchas

1. **Minimal webhook payloads** — always requires API callback for full record state
2. **PropertyChange storm on creation** — 1 creation + N propertyChange events per record
3. **Search 10k cap** — must time-window segment for backfill
4. **5-second webhook response timeout** — must queue and process async
5. **`hs_additional_emails` is read-only via API** despite being visible in UI
6. **v1 Contact Lists API sunsets April 30, 2026**
7. **At-least-once delivery** — must deduplicate on `eventId`
8. **No manual webhook retry** — if 10 retries over 24hrs fail, event is lost

### Pricing & API Access

| Feature | Free | Starter | Professional | Enterprise |
|---|---|---|---|---|
| API access | Yes | Yes | Yes | Yes |
| Webhooks (public app) | Yes | Yes | Yes | Yes |
| Multiple pipelines | No | No | Yes | Yes |
| Custom objects | No | No | No | Yes |
| Daily limit | 250k | 250k | 650k | 1M |

**Webhooks are available on all plans** including Free — this is a major advantage.

---

## Lightfast Entity Mapping

### HubSpot → Lightfast Entities

| HubSpot Object | Lightfast Entity Type | domainEntityId Pattern | Key Transitions |
|---|---|---|---|
| Contact | `hubspot:contact` | `{portalId}/contact/{objectId}` | lifecyclestage changes, lead status changes |
| Company | `hubspot:company` | `{portalId}/company/{objectId}` | New associations, property changes |
| Deal | `hubspot:deal` | `{portalId}/deal/{objectId}` | dealstage transitions (pipeline progression) |
| Ticket | `hubspot:ticket` | `{portalId}/ticket/{objectId}` | pipeline_stage transitions, priority changes |
| Email activity | `hubspot:email` | `{portalId}/email/{objectId}` | sent → opened → clicked → replied |
| Meeting | `hubspot:meeting` | `{portalId}/meeting/{objectId}` | scheduled → completed |
| Call | `hubspot:call` | `{portalId}/call/{objectId}` | logged |

**Deal stage transitions are the highest-value entity transitions for GTM signal.**

### Apollo → Lightfast Entities

| Apollo Object | Lightfast Entity Type | domainEntityId Pattern | Key Transitions |
|---|---|---|---|
| Contact | `apollo:contact` | `contact/{apollo_id}` | contact_stage changes (Cold→Approaching→Replied→Interested) |
| Account | `apollo:account` | `account/{apollo_id}` | account_stage changes |
| Deal | `apollo:deal` | `deal/{apollo_id}` | opportunity_stage transitions |
| Sequence enrollment | `apollo:sequence` | `sequence/{campaign_id}/contact/{contact_id}` | active → finished / removed |
| Email message | `apollo:email` | `email/{message_id}` | sent → opened → clicked → replied → bounced |

**Sequence lifecycle and email engagement are the highest-value Apollo transitions.**

### Cross-Provider Entity Graph Links

This is where the real signal lives — connections between Apollo/HubSpot entities and GitHub/Sentry/Linear entities:

| Link Type | From | To | Signal |
|---|---|---|---|
| Customer ↔ Error | `hubspot:company` (by domain) | `sentry:issue` (by project/org) | Customer experiencing errors → churn risk |
| Prospect ↔ Repo | `apollo:contact` (by github_url) | `github:repo` (by org) | Prospect is actively building → outreach timing |
| Deal ↔ Ticket | `hubspot:deal` (by company association) | `hubspot:ticket` (same portal) | Open support issues during deal → deal risk |
| Customer ↔ PR | `hubspot:company` (by domain) | `github:pr` (by contributor email domain) | Customer contributing to your OSS → expansion signal |
| Sequence ↔ Engagement | `apollo:sequence` | `apollo:email` | Full outreach lifecycle tracking |

**The graph links are resolved by matching on shared identifiers**: email domain, GitHub URL, company domain, org name. The entity graph layer already supports this via `domainEntityId` matching patterns.

---

## Provider Architecture Comparison

| Dimension | HubSpot | Apollo |
|---|---|---|
| **Data ingestion** | Webhook-push (relay) + backfill polling | Polling-only (backfill on schedule) |
| **Auth model** | OAuth2 (full public app) | API key (immediate) → OAuth2 (partner, later) |
| **HMAC verification** | Yes (v3 HMAC-SHA256) | No native signature |
| **Pagination** | Cursor-based (`after` token) | Page-number based (`page` + `per_page`) |
| **Search cap** | 10,000 records per query | 50,000 records per query |
| **Batch operations** | 100 records/batch (all CRUD) | 10 for enrichment, 100 for account create |
| **Rate limits** | 110 req/10s (public app) | ~200 req/min (plan-dependent) |
| **Webhook payload** | Minimal (objectId + changed prop only) | N/A (no webhooks) |
| **Entity richness** | CRM lifecycle + pipeline state | Enrichment data (firmographics, tech stack, funding) |
| **Unique value** | Deal/ticket pipeline progression signal | Prospect intelligence + outreach engagement |

---

## Implementation Order Recommendation

### Phase 1: HubSpot (Webhook-Native Provider)

1. **OAuth2 flow** via gateway (authorization URL, token exchange, refresh)
2. **Webhook subscriptions** via Webhooks API:
   - `contact.creation`, `contact.propertyChange` (lifecyclestage, hs_lead_status)
   - `company.creation`, `company.propertyChange`
   - `deal.creation`, `deal.propertyChange` (dealstage — this is the money signal)
   - `ticket.creation`, `ticket.propertyChange` (hs_pipeline_stage)
3. **Relay webhook receiver**: HMAC-v3 verification, batch payload handling, dedup on `eventId`
4. **Consumer**: Fetch full record state via API on each event (webhook is minimal)
5. **Entity transformers**: Map to `hubspot:contact`, `hubspot:deal`, etc. with transition detection on stage changes
6. **Backfill**: Paginate via `/crm/v3/objects/{type}` with `after` cursor, time-window search for incremental sync

### Phase 2: Apollo (Polling Provider)

1. **API key auth** via gateway (simple `x-api-key` header)
2. **Polling schedule** via Inngest cron:
   - `/contacts/search` with `updated_at` filter — every 5-15 minutes
   - `/emailer_messages/search` with date filter — every 5 minutes for near-real-time engagement data
   - `/opportunities/search` — every 15 minutes
3. **Diff-based transition detection**: Compare polled state against stored entity `currentState` to detect transitions
4. **Enrichment integration**: When new entities arrive from any provider, optionally enrich via Apollo's `/people/match` or `/organizations/enrich`
5. **Entity transformers**: Map to `apollo:contact`, `apollo:email`, `apollo:sequence` with stage/engagement transitions

### Phase 3: Cross-Provider Graph Links

1. **Domain matching**: Link `hubspot:company` ↔ `sentry:project` by company domain
2. **Email matching**: Link `apollo:contact` ↔ `github:pr` by contributor email
3. **GitHub URL matching**: Link `apollo:contact` (github_url field) ↔ `github:user`
4. **Observation synthesis**: "Deal X is at risk — customer's Sentry error rate spiked 3x this week"

---

## Sources

### Apollo Official
- [Apollo API Reference](https://docs.apollo.io) — OpenAPI 3.1 spec
- [Apollo Rate Limits](https://docs.apollo.io/reference/rate-limits)
- [Apollo OAuth2 Partner Guide](https://docs.apollo.io/docs/use-oauth-20-authorization-flow-to-access-apollo-user-information-partners)
- [Apollo API Pricing/Credits](https://docs.apollo.io/docs/api-pricing)
- [Apollo Waterfall Enrichment](https://docs.apollo.io/docs/enrich-phone-and-email-using-data-waterfall)
- [Apollo Org ID Oscillation Bug](https://www.apollo.io/tech-blog/detecting-data-duplication-at-scale)
- [Apollo Knowledge Base](https://knowledge.apollo.io)

### HubSpot Official
- [HubSpot API Reference Overview](https://developers.hubspot.com/docs/api-reference/overview)
- [HubSpot OAuth Working Guide](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/working-with-oauth)
- [HubSpot Webhooks API Guide](https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide)
- [HubSpot Request Validation (HMAC v3)](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/request-validation)
- [HubSpot Rate Limits & Guidelines](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines)
- [HubSpot CRM Understanding Guide](https://developers.hubspot.com/docs/guides/crm/understanding-the-crm)
- [HubSpot Associations v4](https://developers.hubspot.com/docs/api-reference/crm-associations-v4/guide)
- [HubSpot Search API](https://developers.hubspot.com/docs/guides/api/crm/search)
- [HubSpot Pipelines API](https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide)
- [HubSpot Rate Limit Increase (Sep 2024)](https://developers.hubspot.com/changelog/increasing-our-api-limits)

### Community & Third-Party
- [Nango Apollo OAuth Integration](https://nango.dev/docs/integrations/all/apollo-oauth)
- [Hookdeck HubSpot Webhooks Guide](https://hookdeck.com/webhooks/platforms/guide-to-hubspot-webhooks-features-and-best-practices)
- [HubSpot API Gotchas](https://jonsimpson.ca/gotchas-with-the-hubspot-api/)
- [Apollo Pricing Breakdown 2026](https://marketbetter.ai/blog/apollo-io-pricing-breakdown-2026/)

---

**Last Updated**: 2026-03-14
**Confidence Level**: High — official API docs + verified community reports
**Next Steps**: Build HubSpot provider first (webhook-native), Apollo second (polling + enrichment)
