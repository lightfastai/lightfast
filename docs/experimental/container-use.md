# Container-Use Development Workflow

Quick guide for isolated development with container-use + Claude Code MCP.

## What is Container-Use?
- Docker containers + git worktree branches
- Safe isolated development environments  
- No risk to main branch

## Prerequisites
- Docker running
- Container-use CLI
- Claude Code with `.mcp.json`

## Quick Start

### 1. Create Environment
```
mcp__container-use__environment_create
- title: "Your feature name"  # This shows in container-use list!
- environment_source: "/path/to/project"
```
→ Returns environment ID (e.g., `enabling-coral`)

**Naming Convention**: Use this pattern for titles:
```
<git_username>/<type>-<feature-name>
```

Examples:
- `jeevanpillay/feature-complex-math-agent`
- `jeevanpillay/fix-api-timeout`  
- `jeevanpillay/jira123-user-auth`

Get your git username:
```bash
git config user.name  # Returns: jeevanpillay
```

### 2. Configure Environment
```
mcp__container-use__environment_config
```
Example Node.js config:
```json
{
  "base_image": "node:20-slim",
  "setup_commands": ["apt-get update && apt-get install -y git curl"],
  "envs": ["NODE_ENV=development", "API_KEY=..."]
}
```

### 3. Start Development Server
```
mcp__container-use__environment_run_cmd
- command: "cd /workdir && pnpm dev"
- background: true
- ports: [4111]
```
→ Returns:
- `environment_internal`: tcp://abc123:4111
- `host_external`: tcp://127.0.0.1:61439

### 4. Make Changes
- **Write**: `mcp__container-use__environment_file_write`
- **Read**: `mcp__container-use__environment_file_read`
- **Run**: `mcp__container-use__environment_run_cmd`

### 5. Test with Playwright MCP
```
mcp__playwright-mastra__browser_navigate
→ http://127.0.0.1:61439/your-app

mcp__playwright-mastra__browser_type
mcp__playwright-mastra__browser_click
```

### 6. Merge to Main
```bash
container-use checkout <environment-id>
git checkout main  
git merge cu-<environment-id>
```

## View Your Work
- **List active**: `container-use list`
- **Logs**: `container-use log <env-id>`
- **Checkout**: `container-use checkout <env-id>`
- **Diff**: `container-use diff <env-id>`
- **Delete**: `container-use delete <env-id>`

## Real Example: Math Agent Test

1. **Created**: `enabling-coral`
2. **Configured**: Added ANTHROPIC_API_KEY
3. **Tested**:
   - Arithmetic: 15 * 7 + 23 = 128
   - Factorial: 5! = 120  
   - Fibonacci: [0,1,1,2,3,5,8,13,21,34]
4. **Merged**: `git merge cu-enabling-coral`

## Tips
- Use `background: true` for servers
- Internal URL for container-to-container
- External URL for browser access
- Persist config: `container-use config import <env-id>`

## Common Issues

**API Keys Missing**
- Add to `envs` in config
- Re-run `environment_config`

**Can't Connect**  
- Use external URL from browser
- Use internal URL from container

**Server Not Running**
- Check background process started
- Install dependencies first