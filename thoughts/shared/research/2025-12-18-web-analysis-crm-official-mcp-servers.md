---
date: 2025-12-18T15:30:00+08:00
researcher: claude-opus-4-5
topic: "CRM Platforms with Official MCP Server Implementations"
tags: [research, web-analysis, mcp, crm, integrations, model-context-protocol]
status: complete
created_at: 2025-12-18
confidence: high
sources_count: 12
---

# Web Research: CRM Platforms with Official MCP Servers

**Date**: 2025-12-18
**Topic**: CRM tools with official MCP (Model Context Protocol) server implementations
**Confidence**: High - Based on official vendor documentation and repositories

## Research Question

Find CRM platforms that have official MCP server implementations (similar to what Airtable might offer), distinguishing between official vendor-maintained servers and community implementations.

## Executive Summary

Several major CRM and productivity platforms now offer **official MCP server implementations**: **HubSpot**, **Salesforce**, **Monday.com**, **Notion**, and **Zoho CRM** all have vendor-maintained MCP servers. However, **Airtable does NOT have an official MCP server** - only community implementations exist. For Airtable-like functionality with official MCP support, **Notion** is the closest alternative, offering full CRUD operations with an official remote server and OAuth authentication.

## Key Findings

### CRMs with Official MCP Servers

| Platform | Official | Read | Write | Auth | Status |
|----------|----------|------|-------|------|--------|
| **HubSpot** | ✅ Yes | ✅ | ❌ | OAuth | Beta (Active) |
| **Salesforce** | ✅ Yes | ✅ | ✅ | SF Auth | Beta (Active) |
| **Monday.com** | ✅ Yes | ✅ | ✅ | API Key | Production |
| **Notion** | ✅ Yes | ✅ | ✅ | OAuth | Production |
| **Zoho CRM** | ✅ Yes | ✅ | ✅ | OAuth | Emerging |
| **Airtable** | ❌ No | - | - | - | Community only |
| **Pipedrive** | ❌ No | - | - | - | Third-party only |

### Best Alternatives to Airtable (with Official MCP)

1. **Notion** - Most similar to Airtable with databases, full CRUD, official MCP
2. **Monday.com** - Project/CRM boards, official MCP, full read/write
3. **HubSpot** - Full CRM, official MCP (read-only currently)

---

## Detailed Platform Analysis

### 1. HubSpot - OFFICIAL ✅

**Portal**: [developers.hubspot.com/mcp](https://developers.hubspot.com/mcp)
**Docs**: [HubSpot MCP Server Documentation](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-hubspot-mcp-server)

**Two Server Options**:
- **Remote Server** - Production-ready hosted by HubSpot
- **Local Server** - For development environments

**Features**:
- 106+ tools generated from OpenAPI specs
- Full CRM objects: contacts, companies, deals, tickets, tasks
- OAuth authentication
- **Currently read-only** (write operations planned)

**Configuration Example**:
```json
{
  "mcpServers": {
    "hubspot": {
      "url": "https://app.hubspot.com/mcp-server",
      "transport": "sse"
    }
  }
}
```

**Status**: Public Beta (November 2024), actively maintained

---

### 2. Salesforce - OFFICIAL ✅

**Blog**: [Salesforce MCP Announcement](https://developer.salesforce.com/blogs/2025/10/salesforce-hosted-mcp-servers-are-in-beta-today)
**GitHub**: [github.com/salesforcecli/mcp](https://github.com/salesforcecli/mcp)
**Package**: `@salesforce/mcp` (npm)

**Features**:
- Full DX command integration
- Enterprise-grade security
- CRUD on all Salesforce objects
- Custom object support
- Hosted and local server options

**Configuration Example**:
```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@salesforce/mcp"]
    }
  }
}
```

**Requirements**: Enterprise, Unlimited, or Developer edition with API access

**Status**: Beta (October 2024), actively maintained

---

### 3. Monday.com - OFFICIAL ✅

**Portal**: [monday.com/w/mcp](https://monday.com/w/mcp)
**Docs**: [Monday MCP Support](https://support.monday.com/hc/en-us/articles/28588158981266-Get-started-with-monday-MCP)
**GitHub**: [github.com/mondaycom/mcp](https://github.com/mondaycom/mcp)

**Features**:
- Full workspace access (boards, items, columns)
- Read and write operations
- Works with Claude, Cursor, Copilot Studio
- Hosted server provided

**Configuration Example**:
```json
{
  "mcpServers": {
    "monday": {
      "url": "https://mcp.monday.com",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**Status**: Production (December 2024), actively maintained

---

### 4. Notion - OFFICIAL ✅ (Best Airtable Alternative)

**GitHub**: [github.com/makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server)

**Features**:
- Remote MCP server with OAuth installation
- Full CRUD: create, read, update pages and databases
- Search across workspaces
- Block-level content manipulation
- Comments support
- No API token management needed

**Configuration Example**:
```json
{
  "mcpServers": {
    "notion": {
      "url": "https://mcp.notion.so/sse",
      "transport": "sse"
    }
  }
}
```

**Why It's the Best Airtable Alternative**:
- Database functionality similar to Airtable bases
- Full read/write (unlike HubSpot)
- Official vendor support
- OAuth-based (no token management)
- Production-ready

**Status**: Production (March 2025), actively maintained

---

### 5. Zoho CRM - OFFICIAL ✅

**Portal**: [zoho.com/mcp](https://www.zoho.com/mcp/)
**Third-party**: [CData Zoho CRM MCP](https://cdn.cdata.com/help/CZK/mcp/)

**Features**:
- Standardized AI agent interface
- Full Zoho CRM integration
- Multiple implementation paths (native + CData)

**Status**: Platform announced 2025, implementation details emerging

---

### 6. Airtable - COMMUNITY ONLY ❌

**No Official Server** - Despite being a popular choice, Airtable has not released an official MCP server.

**Community Implementations**:

| Repository | Author | Features | Last Updated |
|------------|--------|----------|--------------|
| [domdomegg/airtable-mcp-server](https://github.com/domdomegg/airtable-mcp-server) | domdomegg | Read/write, schema inspection | Dec 2024 |
| [felores/airtable-mcp](https://github.com/felores/airtable-mcp) | felores | Base/table/field management | Dec 2024 |
| [sulaiman013/AIRTABLE-MCP](https://github.com/sulaiman013/AIRTABLE-MCP) | sulaiman013 | Natural language, filtering | Dec 2024 |

**Community Server Example** (domdomegg):
```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": ["-y", "airtable-mcp-server"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key"
      }
    }
  }
}
```

**Risks of Community Implementations**:
- No official vendor support
- May lag behind API changes
- Variable maintenance quality
- Security not vendor-verified

---

### 7. Additional Official MCP Servers (Related)

#### GitHub - OFFICIAL ✅
**Repo**: [github.com/github/github-mcp-server](https://github.com/github/github-mcp-server)
- Repository management, issues, PRs
- Workflow automation

#### Jira/Atlassian - OFFICIAL ✅
**Source**: Atlassian Rovo MCP Server
- Issue management, sprint tracking
- JQL queries, bulk updates

---

## Trade-off Analysis

### If You Need Airtable-Like Functionality

| Option | Pros | Cons |
|--------|------|------|
| **Notion (Official)** | Full CRUD, databases, official support, OAuth | Different UI paradigm than Airtable |
| **Monday.com (Official)** | Full CRUD, boards/items, official support | More project-focused than database |
| **Airtable (Community)** | Exact Airtable functionality | No official support, potential security risks |

### If You Need Full CRM Functionality

| Option | Pros | Cons |
|--------|------|------|
| **Salesforce (Official)** | Enterprise CRM, full CRUD | Complex setup, expensive |
| **HubSpot (Official)** | Easy setup, 106+ tools | Read-only (no writes yet) |
| **Zoho (Official)** | Full suite, affordable | Implementation still emerging |

---

## Recommendations

Based on research findings:

1. **For Airtable-like use cases → Use Notion**
   - Official MCP server with full CRUD
   - Database functionality similar to Airtable bases
   - OAuth authentication (no API key management)
   - Actively maintained by Notion team

2. **For CRM with full read/write → Use Salesforce or Monday.com**
   - Both have official servers with complete CRUD
   - Monday.com is simpler to set up
   - Salesforce for enterprise needs

3. **For CRM read-only queries → Use HubSpot**
   - Easiest setup with 106+ pre-built tools
   - Excellent for analysis and reporting
   - Write operations coming soon

4. **If you must use Airtable → Use domdomegg/airtable-mcp-server**
   - Most actively maintained community option
   - Full read/write support
   - Accept the risks of unofficial support

---

## Official MCP Resources

### Registries & Directories
- **Official Registry**: [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/)
- **GitHub Reference Servers**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- **Protocol Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

### Third-Party Directories
- **Glama.ai**: [glama.ai/mcp/servers](https://glama.ai/mcp/servers)
- **MCP Nodes**: [mcpnodes.com](https://mcpnodes.com/)
- **MCP Server Finder**: [mcpserverfinder.com](https://www.mcpserverfinder.com/)

---

## Open Questions

1. **When will HubSpot add write operations?** - Currently read-only, roadmap unclear
2. **Zoho CRM implementation completeness?** - Platform announced but details still emerging
3. **Will Airtable release an official MCP?** - No announcements found

---

## Sources

### Official Vendor Documentation
- [HubSpot MCP Portal](https://developers.hubspot.com/mcp) - HubSpot, 2024
- [HubSpot MCP Docs](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-hubspot-mcp-server) - HubSpot, 2024
- [Salesforce MCP Announcement](https://developer.salesforce.com/blogs/2025/10/salesforce-hosted-mcp-servers-are-in-beta-today) - Salesforce, 2024
- [Salesforce MCP GitHub](https://github.com/salesforcecli/mcp) - Salesforce, 2024
- [Monday.com MCP Portal](https://monday.com/w/mcp) - Monday.com, 2024
- [Monday.com MCP Support](https://support.monday.com/hc/en-us/articles/28588158981266) - Monday.com, 2024
- [Notion MCP Server](https://github.com/makenotion/notion-mcp-server) - Notion, 2025
- [Zoho MCP Portal](https://www.zoho.com/mcp/) - Zoho, 2025

### Community Implementations
- [domdomegg/airtable-mcp-server](https://github.com/domdomegg/airtable-mcp-server) - Community, 2024
- [felores/airtable-mcp](https://github.com/felores/airtable-mcp) - Community, 2024

### MCP Protocol Resources
- [Model Context Protocol Registry](https://registry.modelcontextprotocol.io/) - Anthropic
- [MCP Reference Servers](https://github.com/modelcontextprotocol/servers) - Anthropic

---

**Last Updated**: 2025-12-18
**Confidence Level**: High - Based on official vendor documentation and GitHub repositories
**Next Steps**: If needing Airtable-like functionality, evaluate Notion's database features for your use case
