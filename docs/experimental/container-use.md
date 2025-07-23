# Container-Use Development Workflow

Quick guide for isolated development with container-use + Claude Code MCP in the lightfast-experimental monorepo.

**IMPORTANT:** Only use container-use when explicitly requested by the user. For normal development tasks, use standard file operations and tools unless the user specifically asks for an isolated container environment.

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
- environment_source: "/Users/jeevanpillay/Code/@lightfastai/hal9000"
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

### 3. Start Development Servers
```bash  
# Start Mastra server (background mode)
mcp__container-use__environment_run_cmd
- command: "cd /workdir && pnpm dev:mastra > /tmp/mastra.log 2>&1 &"
- background: true
- ports: [4111]

# Start web application (background mode)  
mcp__container-use__environment_run_cmd
- command: "cd /workdir && pnpm dev:www > /tmp/web.log 2>&1 &"
- background: true
- ports: [3000]
```
→ Returns:
- `environment_internal`: tcp://abc123:3000, tcp://abc123:4111
- `host_external`: tcp://127.0.0.1:61439, tcp://127.0.0.1:61440

### 4. Make Changes
- **Write**: `mcp__container-use__environment_file_write`
- **Read**: `mcp__container-use__environment_file_read`
- **Run**: `mcp__container-use__environment_run_cmd`

### 5. Test Applications
```bash
# Test web application
mcp__playwright-mastra__browser_navigate
→ http://127.0.0.1:61439 (web app)

# Test Mastra playground
mcp__playwright-mastra__browser_navigate  
→ http://127.0.0.1:61440/agents/a011 (Mastra playground)

# Interact with interfaces
mcp__playwright-mastra__browser_type
mcp__playwright-mastra__browser_click
```

### 6. Check Logs
```bash
# Check server logs
mcp__container-use__environment_run_cmd
- command: "tail -f /tmp/mastra.log"

mcp__container-use__environment_run_cmd
- command: "tail -f /tmp/web.log"
```

### 7. Merge to Main

**Note:** `container-use checkout` switches you to the container branch automatically.

```bash
# First, checkout the container branch (this creates/switches to cu-<environment-id> branch)
container-use checkout <environment-id>

# Switch back to main branch
git checkout main

# Merge the container branch
git merge cu-<environment-id>
```

## View Your Work
- **List active**: `container-use list`
- **Logs**: `container-use log <env-id>`
- **Checkout**: `container-use checkout <env-id>` (switches to `cu-<env-id>` branch)
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

## Container Cleanup Workflow

### Post-Feature Cleanup Steps

After completing a feature and merging to main, follow these steps to clean up:

#### 1. Verify Work is Saved
```bash
# Check if changes are merged to main
git log --oneline | head -5
git status

# Verify container changes are committed
container-use diff <environment-id>
```

#### 2. Safe Container Deletion
```bash
# List all containers to see what you have
container-use list

# Delete specific container (after work is merged)
container-use delete <environment-id>

# Example: Delete our test containers
container-use delete deciding-macaque
container-use delete tidy-seasnail
```

#### 3. Git Branch Cleanup
```bash
# List container-use branches
git branch | grep cu-

# Delete merged container branches
git branch -d cu-<environment-id>

# Force delete if needed (be careful!)
git branch -D cu-<environment-id>
```

### Regular Maintenance Commands

#### Weekly Cleanup Routine
```bash
# 1. List all active containers
container-use list

# 2. Check which ones are old/unused
# Look for containers older than 1 week

# 3. For each old container, check if work is saved
container-use log <old-env-id>
container-use diff <old-env-id>

# 4. Delete unused containers
container-use delete <old-env-id>
```

#### Bulk Cleanup Commands
```bash
# List all container branches
git branch | grep cu- | wc -l

# Delete all merged container branches
git branch | grep cu- | xargs git branch -d

# Clean up Docker resources (if needed)
docker system prune -f
```

### Safety Checks Before Cleanup

⚠️ **Always verify before deleting:**

```bash
# 1. Check for uncommitted changes
container-use diff <env-id>

# 2. Verify work is in main branch
git log --grep="<feature-name>" --oneline

# 3. Check if container has important files
container-use checkout <env-id>
git status
git stash list
```

#### Pre-Cleanup Checklist
- [ ] Feature is merged to main branch
- [ ] All tests pass in main
- [ ] No uncommitted changes in container
- [ ] No important files left untracked
- [ ] Documentation updated if needed

### Container Lifecycle Management

#### When to Keep Containers
- **Active development** - Feature in progress
- **Experimental work** - Prototype or research
- **Reference** - Useful configuration or setup
- **Debugging** - Issue reproduction environment

#### When to Delete Containers
- **Merged features** - Work is safely in main
- **Failed experiments** - No longer needed
- **Old branches** - Older than 2 weeks
- **Duplicate work** - Same feature in multiple containers

### Cleanup Best Practices

#### 1. Descriptive Naming
```bash
# Good: Easy to identify purpose and age
jeevanpillay/feature-openrouter-migration
jeevanpillay/fix-vision-agent-2024-12-19

# Bad: Hard to remember what it was for
deciding-macaque
tidy-seasnail
```

#### 2. Regular Cleanup Schedule
- **Daily**: Check active containers (`container-use list`)
- **Weekly**: Delete completed/merged containers
- **Monthly**: Clean up old branches and Docker images

#### 3. Documentation in Container Titles
```bash
# Include ticket numbers, dates, or status
jeevanpillay/jira-123-user-auth-ready-to-merge
jeevanpillay/hotfix-urgent-production-issue
jeevanpillay/experiment-new-ai-model-2024-12
```

### Emergency Cleanup

If you have too many containers and need to clean up quickly:

```bash
# 1. List all containers with details
container-use list --verbose

# 2. Check which branches exist in main
git branch -r | grep origin

# 3. Safe bulk delete (only merged work)
for env in $(container-use list --format=id); do
  if git branch -r | grep -q "origin/cu-$env"; then
    echo "Branch cu-$env exists remotely, checking if merged..."
    if git merge-base --is-ancestor cu-$env main; then
      echo "Safe to delete: $env"
      container-use delete $env
    fi
  fi
done
```

### Real Example: Cleaning Up Our Test Containers

From our agent testing session, we created containers that should be cleaned up:

```bash
# 1. Check what we created
container-use list
# Shows: deciding-macaque, tidy-seasnail

# 2. Our work was merged to main, so safe to delete
container-use delete deciding-macaque
container-use delete tidy-seasnail

# 3. Clean up the git branches
git branch -d cu-deciding-macaque
git branch -d cu-tidy-seasnail

# 4. Verify cleanup
container-use list  # Should be empty or only show active work
git branch | grep cu-  # Should not show our test branches
```