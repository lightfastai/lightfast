---
date: 2025-12-18T16:30:00+08:00
researcher: claude-opus-4-5
topic: "HubSpot MCP Server Capabilities Deep Dive"
tags: [research, web-analysis, hubspot, mcp, model-context-protocol, api, integration]
status: complete
created_at: 2025-12-18
confidence: high
sources_count: 15+
---

# Web Research: HubSpot MCP Server Capabilities

**Date**: 2025-12-18
**Topic**: Deep dive into HubSpot's official MCP server capabilities, tools, and limitations
**Confidence**: High - Based on official HubSpot documentation and npm package

## Research Question

What are HubSpot's MCP server capabilities, available tools, read/write support, and limitations?

## Executive Summary

HubSpot provides **two official MCP servers**: a **Remote MCP Server** for CRM data access and a **Developer MCP Server** for local development automation. Both are in **public beta** (launched May 2025). The critical limitation: **both are currently READ-ONLY** with no write operations supported. Write operations are planned for "later 2025" but no specific timeline exists. For write operations today, you must use community-built MCP servers or direct API integration.

---

## Two Official HubSpot MCP Servers

### 1. Remote MCP Server (CRM Data Access)

| Attribute | Value |
|-----------|-------|
| **Package** | `@hubspot/mcp-server` |
| **NPM** | https://www.npmjs.com/package/@hubspot/mcp-server |
| **Maintainer** | HubSpot (official) |
| **Status** | Public Beta |
| **Operations** | **READ-ONLY** |
| **Install** | `npx -y @hubspot/mcp-server` |

### 2. Developer MCP Server (Dev Tools)

| Attribute | Value |
|-----------|-------|
| **Access** | HubSpot CLI (`hs mcp setup`) |
| **Maintainer** | HubSpot (official) |
| **Status** | Beta |
| **Purpose** | Local development workflow automation |
| **Operations** | Project management, not CRM data |

---

## Remote MCP Server - Available Tools

### CRM Objects Accessible (Read-Only)

| Object | Read | Write | Update | Delete |
|--------|------|-------|--------|--------|
| Contacts | ✅ | ❌ | ❌ | ❌ |
| Companies | ✅ | ❌ | ❌ | ❌ |
| Deals | ✅ | ❌ | ❌ | ❌ |
| Tickets | ✅ | ❌ | ❌ | ❌ |
| Products | ✅ | ❌ | ❌ | ❌ |
| Line Items | ✅ | ❌ | ❌ | ❌ |
| Quotes | ✅ | ❌ | ❌ | ❌ |
| Orders | ✅ | ❌ | ❌ | ❌ |
| Carts | ✅ | ❌ | ❌ | ❌ |
| Custom Objects | ✅ | ❌ | ❌ | ❌ |

### Core Operations

1. **Retrieve objects** - Get individual CRM records by ID
2. **List objects** - Browse collections with pagination
3. **Search objects** - Query CRM data with filters
4. **View properties** - Access object metadata and schema

### API Coverage

| HubSpot API | MCP Coverage |
|-------------|--------------|
| CRM Objects API | ✅ Extensive (read) |
| Search API | ✅ Supported |
| Properties API | ✅ Supported |
| Associations API | ⚠️ Limited |
| Marketing API | ❌ Not available |
| Email API | ❌ Not available |
| Workflows API | ❌ Not available |
| Analytics API | ❌ Not available |

---

## Configuration

### Claude Desktop Setup

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "HubspotMCP": {
      "command": "npx",
      "args": ["-y", "@hubspot/mcp-server"],
      "env": {
        "PRIVATE_APP_ACCESS_TOKEN": "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

### Getting Your Access Token

1. Log into HubSpot → Settings
2. Account Setup → Integrations → Private Apps
3. Create a private app
4. Select scopes (see below)
5. Copy the access token

### Required Scopes

```
crm.objects.contacts.read
crm.objects.companies.read
crm.objects.deals.read
crm.objects.tickets.read
crm.objects.custom.read
crm.objects.line_items.read
crm.objects.quotes.read
```

Full scope list: https://developers.hubspot.com/docs/api/private-apps

---

## What You CAN Do (Read Operations)

### Example Prompts

**Sales Pipeline Analysis**:
```
"Find all deals over $50,000 that are stuck in the negotiation stage"
```

**Contact Research**:
```
"Get contact information for the CEO of Acme Corp and show recent activity"
```

**Company Analysis**:
```
"List all companies in the technology industry with more than 100 employees"
```

**Deal Tracking**:
```
"Show me deals closing this month with their associated contacts"
```

**Recent Activity**:
```
"What are the most recently modified contacts in my CRM?"
```

---

## What You CANNOT Do (Write Limitations)

### Not Supported in Official Server

| Operation | Status |
|-----------|--------|
| Create contacts | ❌ |
| Update contact info | ❌ |
| Create companies | ❌ |
| Create/update deals | ❌ |
| Change deal stages | ❌ |
| Log calls/emails | ❌ |
| Create tasks | ❌ |
| Add notes | ❌ |
| Associate records | ❌ |
| Delete anything | ❌ |
| Bulk operations | ❌ |

**HubSpot's Statement**:
> "The HubSpot MCP Server supports read-only access to the following CRM objects..."

---

## Community Alternatives (With Write Support)

If you need write operations NOW:

### lkm1developer/hubspot-mcp-server

**GitHub**: https://github.com/lkm1developer/hubspot-mcp-server

**Tools Available** (8 total):
1. `hubspot_create_contact` - Create contacts with duplicate checking
2. `hubspot_create_company` - Create companies
3. `hubspot_update_contact` - Update existing contacts
4. `hubspot_update_company` - Update companies
5. `hubspot_get_company_activity` - Retrieve engagement history
6. `hubspot_get_recent_engagements` - Recent activity
7. `hubspot_get_active_companies` - Recently modified companies
8. `hubspot_get_active_contacts` - Recently modified contacts

**Configuration**:
```json
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": ["-y", "@lkm1developer/hubspot-mcp-server"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

### Community 106-Tool Server

**Source**: HubSpot Community - Open-source MCP with 106 tools generated from OpenAPI specs

More comprehensive but less maintained than official.

---

## Rate Limits

### Standard HubSpot API Limits (Apply to MCP)

| Limit Type | Value |
|------------|-------|
| Search API | 5 requests/second |
| Search results | 200 records/page |
| Daily limit | Varies by tier |

### Known Issues

- MCP may make multiple API calls per operation
- Can trigger rate limits faster than expected
- Community reports hitting limits during normal usage

---

## Roadmap (2025)

### Announced Plans

| Feature | Timeline |
|---------|----------|
| OAuth 2.1 support | Later 2025 |
| Write operations | "Planned" (no date) |
| Enhanced distribution | 2025 |

### Community Requests

Most wanted features:
- Create/update CRM records
- Activity logging (calls, emails, tasks)
- Workflow triggers
- Marketing Hub integration
- Bulk operations

---

## Comparison: Official vs Community vs Direct API

| Feature | Official MCP | Community MCP | Direct API |
|---------|--------------|---------------|------------|
| **Read CRM** | ✅ | ✅ | ✅ |
| **Write CRM** | ❌ | ✅ | ✅ |
| **Natural language** | ✅ | ✅ | ❌ |
| **Official support** | ✅ | ❌ | ✅ |
| **Maintenance** | HubSpot | Community | You |
| **Setup complexity** | Low | Low | Medium |
| **Full API access** | ⚠️ Limited | ⚠️ Limited | ✅ Full |
| **Bulk operations** | ❌ | ⚠️ Some | ✅ |

### When to Use Each

**Official MCP**: Read-only analysis, safe production use, official support needed

**Community MCP**: Need writes today, accept maintenance risk, experimental use

**Direct API**: Production integrations, full control, write-heavy workflows

---

## Developer MCP Server

For developers building on HubSpot platform:

### Setup
```bash
hs mcp setup
```

### Capabilities
- Create new projects
- Add features (app cards, workflow actions, settings)
- Upload to HubSpot
- Project validation
- CLI workflow automation

### Example Prompts
```
"Create a new project with app cards and a custom workflow action"
"Add a React theme to my existing project"
"Validate my project, then upload it to HubSpot"
```

---

## Key Takeaways

### The Good

1. **Official HubSpot support** - Not a community hack
2. **Easy setup** - Single token, npm package
3. **Comprehensive read access** - All CRM objects
4. **Two specialized servers** - CRM data + dev tools
5. **Active development** - Beta with 2025 roadmap

### The Bad

1. **READ-ONLY** - No writes, updates, or deletes
2. **No write timeline** - "Later 2025" is vague
3. **Limited API coverage** - No marketing, workflows, analytics
4. **Rate limit issues** - Can hit limits quickly
5. **No marketing hub** - Email campaigns not accessible

### The Verdict

**For read-only CRM access**: HubSpot's official MCP is excellent - use it.

**For write operations**: Use community MCP servers or direct API integration until HubSpot adds write support (sometime in 2025).

---

## Sources

### Official Documentation
- [HubSpot MCP Portal](https://developers.hubspot.com/mcp)
- [Integration Documentation](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-hubspot-mcp-server)
- [NPM Package](https://www.npmjs.com/package/@hubspot/mcp-server)
- [Private Apps & Scopes](https://developers.hubspot.com/docs/api/private-apps)
- [API Rate Limits](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines)

### Community Resources
- [HubSpot Community MCP Discussion](https://community.hubspot.com/t5/APIs-Integrations/Open-source-MCP-for-HubSpot-106-CRM-Tools-Public-Beta/td-p/1216305)
- [lkm1developer/hubspot-mcp-server](https://github.com/lkm1developer/hubspot-mcp-server)
- [Setup Guide](https://generect.com/blog/hubspot-mcp-server-setup/)
- [Use Cases](https://huble.com/blog/hubspot-mcp-ai-use-cases)

---

**Last Updated**: 2025-12-18
**Confidence Level**: High - Based on official HubSpot documentation
**Next Steps**: Monitor HubSpot changelog for write operations announcement
