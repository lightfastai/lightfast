---
description: Manage connector settings: configure, audit, create, test, or research integrations
---

# Manage Connector

You orchestrate agents to help users manage third-party OAuth/webhook connectors (Vercel, GitHub, Sentry, etc.) through multiple modes: configure existing settings, audit current state, create new integrations, test functionality, or **research how to build new integrations**.

## CRITICAL: AGENT ORCHESTRATION ONLY

- DO NOT perform browser automation yourself
- DO NOT hardcode service-specific details (webhook events, URLs, etc.)
- ALWAYS discover implementation details from codebase first
- ALWAYS wait for agents to complete before proceeding
- The codebase is the source of truth for all configuration

## Initial Response

When this command is invoked:

1. **Determine service and mode**:

   **If invoked with args** (e.g., `/manage-connector vercel configure`):
   - Extract service and mode from args
   - Proceed to appropriate mode

   **If invoked without args**, ask:
   ```
   Which connector and what mode?

   **Connectors**: Vercel, GitHub, Sentry, Linear, Slack, Clerk, etc.

   **Modes**:
   - **configure** - Update URLs, webhook events, or settings (most common)
   - **audit** - Check current platform settings vs codebase expectations
   - **create** - Create new app/integration in platform
   - **test** - Trigger test events to verify integration
   - **research** - Research how to BUILD a new integration into Lightfast

   Example: "vercel configure" or "sentry research"
   ```

   **IMPORTANT**: Distinguish between:
   - `{service} configure/audit/create/test` → Manage an EXISTING connector in our codebase
   - `{service} research` → Research how to BUILD a NEW integration (external platform docs, APIs, webhooks)

2. **Wait for user to specify service and mode** before proceeding.

Once determined, proceed to the appropriate mode flow.

---

## Mode 1: Configure (Update Settings)

**Use case**: Update existing connector settings (URLs, webhook events, credentials)

### Step 1: Analyze Codebase

Spawn `codebase-analyzer`:

```
Analyze the {SERVICE} connector implementation in the codebase.

Find with exact file:line references:

1. **Webhook Events**:
   - Search packages/console-webhooks/ for {SERVICE} webhook handling
   - Find event type definitions, enums, or constants
   - List all implemented events

2. **API Routes**:
   - Find OAuth callback route (e.g., /api/{service}/callback)
   - Find webhook receiver route (e.g., /api/{service}/webhooks)
   - Look in api/console/src/ or apps/console/src/app/

3. **Environment Variables**:
   - Search for {SERVICE}_* environment variables
   - Find client ID, secret, webhook secret names

4. **Settings UI** (if exists):
   - Find connector settings pages in apps/console/

Provide concrete file:line references. Do not suggest improvements.
```

**Wait for codebase-analyzer to complete.**

### Step 1.5: Platform Research (Optional)

Ask user:
```
Research {SERVICE} platform documentation for current UI patterns? (yes/no)

Helpful if UI has changed or you're unfamiliar with the platform.
```

**If yes**, spawn `web-search-researcher`:

```
Research {SERVICE} integration platform documentation.

Focus on:
1. Connector settings location and navigation
2. Available webhook events (full list)
3. OAuth/API configuration steps
4. Recent UI changes or gotchas

Search: Official docs, API reference, developer guides

Return: Direct links, key quotes, navigation steps, version notes
```

**Wait if user requested research.**

### Step 2: Present Menu

```
{SERVICE} Connector - Configure Mode

**Codebase Analysis**:
- Webhook Events (from {file:line}): {list}
- Callback Route: {route} (from {file:line})
- Webhook Route: {route} (from {file:line})
- Environment Variables: {list}

{If platform research done:}
**Platform Documentation**:
- Settings URL: {link}
- Available events: {link}
- Recent changes: {summary}

What would you like to configure?
1. Update URLs (redirect/webhook)
2. Update webhook events (add/remove subscriptions)
3. View/regenerate credentials
4. Other settings

Specify action and details (e.g., "update URLs for https://abc.ngrok-free.app")
```

**Wait for user input.**

### Step 3: Execute Configuration

Spawn `connector-manager`:

```
Configure {SERVICE} connector for Lightfast.

**Service**: {SERVICE}
**Action**: {user's specific request}

**From Codebase**:
- Callback URL: `{ngrok-url}{callback-path}` (from {file:line})
- Webhook URL: `{ngrok-url}{webhook-path}` (from {file:line})
- Events: {list}
- Env vars: {list}

{If platform research done:}
**From Documentation**:
- Settings location: {URL and navigation}
- UI instructions: {steps}
- Available events: {list with links}
- Notes: {gotchas}

{Otherwise:}
**Navigation**:
- Try: https://{service}/settings/integrations/{app}
- Or ask user for direct URL if needed

**UI hints**: Look for Save/Update buttons, check for success messages

Execute the configuration and report results.
```

**Wait for connector-manager to complete.**

### Step 4: Confirm

```
✅ Configuration complete!

**Service**: {SERVICE}
**Changes**: {summary from agent}

{If URLs updated:}
⚠️ Restart dev server:
```bash
pkill -f "next dev"
pnpm dev:console
```

Need anything else?
```

---

## Mode 2: Audit (Verify Settings)

**Use case**: Check if platform settings match codebase expectations

### Step 1: Analyze Expected State

Spawn `codebase-analyzer` (same as configure mode Step 1).

**Wait for completion.**

### Step 2: Capture Current State

Spawn `connector-manager` in read-only mode:

```
Audit {SERVICE} connector settings.

**Service**: {SERVICE}
**Mode**: READ-ONLY (do not modify anything)

Navigate to connector settings and capture:
1. Current redirect/callback URLs
2. Current webhook URL
3. Enabled webhook events
4. OAuth scopes (if visible)
5. Screenshot of key settings

**Navigation**:
- Try common patterns or ask user for URL
- Take screenshots for verification

Return current state without making changes.
```

**Wait for connector-manager to complete.**

### Step 3: Compare and Report

Compare codebase expectations with captured state:

```
{SERVICE} Connector Audit Results

**Expected (from codebase)**:
- Callback URL should end with: {path}
- Webhook URL should end with: {path}
- Webhook events should include: {list}
- Env vars configured: {list}

**Actual (from platform)**:
- Callback URL: {captured}
- Webhook URL: {captured}
- Webhook events: {captured}

**Status**:
✅ Matches: {list what's correct}
⚠️ Mismatches:
  - {specific mismatch 1}
  - {specific mismatch 2}

{If mismatches:}
Would you like to fix these mismatches? (yes = switch to configure mode)
```

---

## Mode 3: Create (New Integration)

**Use case**: Create a brand new app/integration in the platform

### Step 1: Research Platform Creation Flow (Required)

Spawn `web-search-researcher`:

```
Research how to create a new {SERVICE} integration/app.

Focus on:
1. **App creation flow**:
   - Where to start creating new app/integration
   - Required fields (name, description, URL, etc.)
   - OAuth scopes to request
   - Webhook configuration during setup

2. **Post-creation steps**:
   - How to access credentials after creation
   - Any additional configuration needed
   - Verification or approval process

3. **Common pitfalls**:
   - Typical errors during creation
   - Required prerequisites
   - Platform-specific requirements

Search official docs, return step-by-step guide with links.
```

**Wait for web-search-researcher to complete.**

### Step 2: Gather App Details

Ask user for required info:

```
Creating new {SERVICE} integration.

**From platform docs**: {summary of creation process}

I'll need:
1. App/integration name (e.g., "Lightfast Dev")
2. App description (brief)
3. Base URL for OAuth callback (your ngrok URL or production domain)
4. Which OAuth scopes to request: {suggestions from docs}
5. Initial webhook events to enable: {suggestions from codebase analysis}

You can also provide just the ngrok URL and I'll use sensible defaults.

Please provide these details.
```

**Wait for user input.**

### Step 3: Analyze Codebase for Routes

Spawn `codebase-analyzer` (if not already done) to find callback/webhook paths.

**Wait for completion.**

### Step 4: Create Integration

Spawn `connector-manager`:

```
Create new {SERVICE} integration.

**Service**: {SERVICE}
**Mode**: CREATE

**App Details** (from user):
- Name: {name}
- Description: {description}
- Base URL: {base-url}
- OAuth scopes: {scopes}
- Webhook events: {events}

**Routes** (from codebase):
- Callback URL: {base-url}{callback-path}
- Webhook URL: {base-url}{webhook-path}

**Creation Instructions** (from platform docs):
{step-by-step from web research}

Steps:
1. Navigate to app creation page
2. Fill in app details
3. Configure OAuth settings
4. Set up webhook settings
5. Submit and capture credentials
6. Take screenshots of credentials page

Return: Client ID, Client Secret, and any other credentials displayed.
```

**Wait for connector-manager to complete.**

### Step 5: Provide Credentials

```
✅ {SERVICE} integration created!

**Credentials** (add to .env):
```
{ENV_VAR_1}="{client_id}"
{ENV_VAR_2}="{client_secret}"
{ENV_VAR_3}="{other_credential}" # if applicable
```

**App configured with**:
- Callback URL: {url}
- Webhook URL: {url}
- OAuth scopes: {list}
- Webhook events: {list}

**Next steps**:
1. Add credentials to your .env file
2. Restart dev server: `pnpm dev:console`
3. Test the integration with `/manage-connector {service} test`

{Screenshot of credentials attached if available}
```

---

## Mode 4: Test (Verify Integration)

**Use case**: Trigger test events and verify integration works

### Step 1: Determine Test Scope

Ask user:

```
Test {SERVICE} integration.

What would you like to test?
1. **OAuth flow** - Test authorization/callback
2. **Webhook delivery** - Trigger test webhook event
3. **Full flow** - Complete user journey
4. **Specific scenario** - Describe what to test

Please specify.
```

**Wait for user input.**

### Step 2: Analyze Implementation

Spawn `codebase-analyzer`:

```
Analyze {SERVICE} connector implementation for testing.

Find:
1. Webhook handler implementation (file:line)
2. OAuth callback handler (file:line)
3. Database tables affected
4. Expected event processing flow
5. Test files if they exist

This will help identify what to verify during testing.
```

**Wait for completion.**

### Step 3: Research Test Capabilities

Spawn `web-search-researcher`:

```
Research how to test {SERVICE} integrations.

Find:
1. How to trigger test webhooks from the platform
2. Test mode or sandbox environment availability
3. How to view webhook delivery logs
4. OAuth testing best practices

Return direct links to testing documentation.
```

**Wait for completion.**

### Step 4: Guide Testing

Based on test capabilities discovered:

**If platform supports test events**:

```
I'll trigger a test webhook from {SERVICE}.

{From platform docs}: {how to trigger test events}

Spawning connector-manager to navigate UI and trigger test event...
```

Spawn `connector-manager`:

```
Trigger test webhook for {SERVICE}.

Navigate to webhook settings and trigger a test event.
Look for "Send test webhook" or similar functionality.

Return the response/confirmation from platform.
```

**Wait and verify results:**

```
Test event triggered: {event_type}

Check your local logs or database to verify:
```bash
# Check recent webhook deliveries
sqlite3 ~/.lightfast/console.db "SELECT * FROM webhook_deliveries WHERE service='{service}' ORDER BY created_at DESC LIMIT 5;"

# Or check application logs
tail -f /tmp/console-dev.log | grep {service}
```

Did the webhook get processed? (Verify in DB or logs)
```

**If platform doesn't support test mode**:

```
{SERVICE} doesn't provide built-in test events.

**Manual testing approach**:

1. **For OAuth**: Click this test link (opens authorization flow)
   {construct OAuth URL from codebase}

2. **For webhooks**: You'll need to trigger a real event
   {guidance on triggering real event based on platform}

3. **Verification**: I can help check logs/database:
```bash
# Check for recent events
tail -f /tmp/console-dev.log | grep {service}
```

Would you like me to help with any of these steps?
```

---

## Mode 5: Research (Plan New Integration)

**Use case**: Research how to build a NEW integration into Lightfast's memory system. This is for services we DON'T yet have a connector for.

**CRITICAL DISTINCTION**:
- This mode researches the **external platform's developer documentation** (APIs, webhooks, OAuth)
- It does NOT analyze our codebase for existing implementations
- Goal: Understand what the platform offers so we can build a connector

### Step 1: Clarify Research Scope

Ask user:

```
Research {SERVICE} integration for Lightfast Memory.

What aspects should I research?
1. **Full integration** - OAuth, webhooks, APIs, data model (comprehensive)
2. **Webhooks only** - Available events, payload schemas, setup
3. **OAuth only** - Scopes, authentication flow, token management
4. **API only** - REST/GraphQL endpoints, rate limits, data access
5. **Specific topic** - Describe what you need

Example: "full integration" or "webhooks for issue tracking"
```

**Wait for user input.**

### Step 2: Research External Platform

Spawn `web-search-researcher`:

```
Research {SERVICE} developer platform for building an integration into Lightfast.

**Service**: {SERVICE}
**Focus**: {user's specified scope}

DO NOT search our codebase. Research the EXTERNAL platform documentation.

**For Full Integration, research**:

1. **Integration Platform Overview**:
   - Developer documentation URL
   - Integration types available (OAuth app, webhook, API-only)
   - Public vs internal integration options
   - Example: https://docs.sentry.io/organization/integrations/integration-platform/

2. **Authentication & OAuth**:
   - OAuth 2.0 flow specifics
   - Required scopes and what they grant access to
   - Token refresh mechanism
   - Installation flow (per-org, per-user, etc.)

3. **Webhooks**:
   - Available webhook events (full list)
   - Payload schemas for each event type
   - Webhook verification/signing mechanism
   - Retry policy and delivery guarantees

4. **APIs**:
   - REST/GraphQL endpoints
   - Rate limits
   - Data models and relationships
   - Pagination patterns

5. **Data Available for Memory**:
   - What data can we pull for Lightfast's memory feature?
   - Issues, errors, alerts, deployments, etc.
   - Real-time vs batch data access

**For Webhooks Only**:
- Focus on sections 3 and 5 above

**For OAuth Only**:
- Focus on section 2 above

**For API Only**:
- Focus on sections 4 and 5 above

Return:
- Direct links to relevant documentation pages
- Key quotes about authentication, webhooks, APIs
- Data models and event types
- Any gotchas or platform-specific requirements
- Recommended integration approach for Lightfast
```

**Wait for web-search-researcher to complete.**

### Step 3: Gather Metadata

Run the metadata script to get current context:

```bash
hack/spec_metadata.sh
```

This provides: date, researcher, git commit, branch, repository.

### Step 4: Write Research Document

Write findings to `thoughts/shared/research/` following the standard pattern:

**Filename**: `thoughts/shared/research/YYYY-MM-DD-{service}-integration-research.md`

Example: `thoughts/shared/research/2025-01-15-sentry-integration-research.md`

**Document structure**:

```markdown
---
date: [ISO timestamp with timezone]
researcher: [From metadata]
git_commit: [From metadata]
branch: [From metadata]
repository: lightfast
topic: "{SERVICE} Integration Research"
tags: [research, integration, {service}, connector]
status: complete
last_updated: [YYYY-MM-DD]
last_updated_by: [Researcher]
---

# Research: {SERVICE} Integration for Lightfast Memory

**Date**: [timestamp]
**Researcher**: [name]
**Git Commit**: [hash]
**Branch**: [branch]

## Research Question
How to integrate {SERVICE} into Lightfast's memory system.

## Summary
[High-level overview of findings]

## Documentation Links
- Developer Portal: {link}
- Integration Guide: {link}
- API Reference: {link}
- Webhook Reference: {link}

## Integration Type
{public app / internal integration / OAuth app}

## Authentication

### OAuth Flow
- Flow type: {OAuth 2.0 / API key / etc.}
- Authorization URL: {url}
- Token URL: {url}
- Scopes needed:
  - `{scope}` - {description}

### Token Management
- Refresh mechanism: {details}
- Token expiry: {duration}

## Webhooks

### Available Events
{For each relevant event type:}
| Event | Description | Memory Use Case |
|-------|-------------|-----------------|
| `{event.type}` | {description} | {how this helps Lightfast} |

### Webhook Verification
- Signing mechanism: {HMAC-SHA256 / etc.}
- Header: `{X-Signature-Header}`
- Verification process: {details}

### Payload Examples
```json
// {event.type} payload
{example}
```

## APIs

### Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/{resource}` | GET | {description} |

### Rate Limits
- {limit details}

### Pagination
- {pagination pattern}

## Data for Lightfast Memory
{What data from this service would enrich agent context}

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| {type} | {description} | {value} |

## Recommended Implementation Approach
{Summary of how to build this integration}

1. {step 1}
2. {step 2}
3. {step 3}

## Platform-Specific Notes
- {gotcha 1}
- {gotcha 2}

## Related Research
[Links to other research documents in thoughts/shared/research/]

## Next Steps
1. Use `/create_plan {service} integration` to plan implementation
2. Review existing connector implementations (e.g., Vercel) for patterns
```

### Step 5: Present Summary

After writing the document:

```
✅ Research complete!

**Document**: thoughts/shared/research/YYYY-MM-DD-{service}-integration-research.md

**Key Findings**:
- Integration type: {type}
- OAuth scopes: {count} scopes needed
- Webhook events: {count} relevant events
- APIs: {summary}

**Next Steps**:
1. Review the full document for details
2. Use `/create_plan {service} integration` to plan implementation
3. Or ask follow-up questions

Would you like me to:
- Research any aspect in more depth?
- Create an implementation plan?
- Compare with how we built another connector (e.g., Vercel)?
```

### Step 6: Handle Follow-ups

If user wants more detail on a specific aspect:

1. Spawn another `web-search-researcher` with focused query
2. **Append** to the existing research document (don't create new file)
3. Update frontmatter: `last_updated`, `last_updated_by`, add `last_updated_note`
4. Add new section: `## Follow-up Research: {topic} [{timestamp}]`

---

## Important Notes

**Mode Selection**:
- **configure** - Most common; updating existing connector settings
- **audit** - Before making changes to see current state
- **create** - Setting up new connector app in platform for first time
- **test** - After implementation or when debugging
- **research** - When planning to BUILD a new integration (no existing code)

**Critical Ordering**:
- For configure/audit/create/test: ALWAYS analyze codebase first
- For research: SKIP codebase analysis (focus on external platform docs)
- ALWAYS wait for agents to complete before proceeding
- ALWAYS ask user for input at decision points

**Agent Coordination**:
- `codebase-analyzer` discovers internal implementation
- `web-search-researcher` discovers external platform docs
- `connector-manager` performs browser automation
- This command orchestrates and provides context

**Source of Truth**:
- Codebase defines what's implemented (routes, events, env vars)
- Platform defines what's possible (available events, scopes)
- Audit mode reveals what's actually configured
- Test mode verifies everything works together

**Error Handling**:
- If user doesn't specify mode → Ask
- If codebase analysis fails → Ask for manual input
- If platform changed → Use web research to adapt
- If login required → Pause and ask user to log in

---

## Common Workflows

### Workflow 1: New ngrok Session (Configure)
```
User: "/manage-connector vercel configure"
→ Analyzes Vercel codebase
→ Asks about platform research (optional)
→ Shows menu
User: "Update URLs for https://abc.ngrok-free.app"
→ Spawns connector-manager
→ Updates Vercel settings
→ Confirms completion
```

### Workflow 2: Verify Settings (Audit)
```
User: "/manage-connector github audit"
→ Analyzes GitHub codebase
→ Spawns connector-manager (read-only)
→ Captures current settings
→ Compares with expectations
→ Reports mismatches
```

### Workflow 3: New Connector (Create)
```
User: "/manage-connector sentry create"
→ Researches Sentry app creation docs
→ Asks for app details
→ Analyzes codebase for routes
→ Spawns connector-manager
→ Creates app, captures credentials
→ Provides env vars to add
```

### Workflow 4: Test Integration (Test)
```
User: "/manage-connector vercel test webhooks"
→ Analyzes Vercel webhook handler
→ Researches how to trigger test events
→ Spawns connector-manager to trigger
→ Guides user to verify in logs/DB
```

### Workflow 5: Research New Integration (Research)
```
User: "/manage-connector sentry research"
→ Asks about research scope (full, webhooks, OAuth, API)
User: "full integration"
→ Spawns web-search-researcher (NOT codebase-analyzer)
→ Researches Sentry's integration platform docs
→ Returns: OAuth flow, webhook events, APIs, data models
→ Suggests next steps for implementation
```

### Workflow 6: Research Specific Aspect
```
User: "/manage-connector clerk research"
→ Asks about research scope
User: "webhooks for user management"
→ Researches Clerk webhook events for users
→ Returns: user.created, user.updated, user.deleted events
→ Payload schemas, verification, use cases for memory
```

---

## Benefits

**Multi-mode flexibility**:
- Single command handles full connector lifecycle
- Clear separation between configuration, auditing, creation, testing, and research
- Mode-based branching keeps flows focused
- Research mode enables planning new integrations from scratch

**Codebase-driven**:
- Discovers routes, events, env vars from actual code
- No hardcoded assumptions about implementation
- File:line references for verification

**Platform-aware** (via web research):
- Adapts to UI changes
- Discovers available features
- Handles platform-specific quirks

**Workflow-oriented** (like HumanLayer):
- Reuses existing agents (no new specialized agents needed)
- Complements other commands (research-codebase, create-plan, implement-plan, debug)
- Integrates into development workflow naturally
