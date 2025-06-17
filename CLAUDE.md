# Claude Code Development Workflow

**YOU MUST** follow this complete development workflow when working with this chat application project.

## 🚨 MANDATORY WORKTREE RULE

**YOU MUST ALWAYS** use git worktrees for ANY development work including:
- Feature requests (e.g., "integrate react-scan", "add dark mode")
- Bug fixes (e.g., "fix login issue", "resolve memory leak")
- Chores (e.g., "update dependencies", "refactor components")
- Integrations (e.g., "add Sentry", "integrate analytics")
- ANY code changes whatsoever

**NO EXCEPTIONS**: If you're modifying code, you MUST be in a worktree.

## Overview

This development workflow integrates:
- **GitHub MCP Server**: Issue tracking and PR management
- **Git Worktrees**: Feature development with `jeevanpillay/<feature_name>` branches (MANDATORY for all work)
- **Vercel-First Testing**: All application testing on Vercel preview deployments (NO local dev servers)
- **Context Preservation**: GitHub comments + local context files to survive session interruptions
- **Turborepo + Bun**: Lightning-fast builds with intelligent caching

## 🚨 CRITICAL: Context Preservation

**YOU MUST** preserve context to survive terminal crashes and session interruptions:

### 1. Local Context File (First Priority)
```bash
# ALWAYS set this variable at start of each session
CONTEXT_FILE="/tmp/claude-context-$(basename $(pwd)).md"

# Create or check existing context file
if [ -f "$CONTEXT_FILE" ]; then
  echo "📋 Resuming from existing context:"
  cat "$CONTEXT_FILE"
else
  echo "🆕 Creating new context file: $CONTEXT_FILE"
fi
```

### 2. GitHub Comments (Second Priority)
**YOU MUST** post comments for every significant action:
```bash
# Starting work
gh pr comment <pr_number> --body "🚀 Starting: <task_description>"

# Progress updates (every 30-60 minutes)
gh pr comment <pr_number> --body "🔧 Progress: <completed_items>"

# Completing tasks
gh pr comment <pr_number> --body "✅ Completed: <task_description>"

# Encountering blockers
gh pr comment <pr_number> --body "⚠️ Blocker: <issue_description>"
```

## End-to-End Workflow

### Step 1: Resume or Start Work

**ALWAYS** check for existing work first:
```bash
# Check existing worktrees
git worktree list

# Check for existing context files
ls -la /tmp/claude-context-*.md

# If worktree exists, navigate to it
cd worktrees/<feature_name>

# Load existing context
CONTEXT_FILE="/tmp/claude-context-$(basename $(pwd)).md"
cat "$CONTEXT_FILE" 2>/dev/null || echo "No existing context found"
```

### Step 2: Issue Creation with Templates

**YOU MUST** use issue templates for all work:

1. **Feature Request** - For new features
2. **Bug Report** - For fixing issues
3. **Quick Task** - For simple tasks

**File References**: Use `@src/path/to/file.tsx` to help Claude navigate directly to relevant files.

```bash
# Create issue and add to project
ISSUE_URL=$(gh issue create --repo lightfastai/chat \
  --title "feat: <description>" \
  --body "<detailed_description>")
ISSUE_NUM=$(echo $ISSUE_URL | grep -oE "[0-9]+$")
gh project item-add 2 --owner lightfastai --url $ISSUE_URL
echo "Created issue #$ISSUE_NUM and added to project"
```

### Step 3: Worktree Setup

**MANDATORY**: You MUST create a worktree for ANY code changes. Use the automated setup script:
```bash
# Automated setup (RECOMMENDED)
./scripts/setup-worktree.sh jeevanpillay/<feature_name>
cd worktrees/<feature_name>

# Manual setup (if script unavailable)
git checkout main && git pull origin main
mkdir -p worktrees
git worktree add worktrees/<feature_name> -b jeevanpillay/<feature_name>
cd worktrees/<feature_name>
bun install
cp ../../.env.local .env.local
bun run env:sync
```

### Step 4: Development Cycle

**YOU MUST** follow this exact pattern:
```bash
# 1. Set up context tracking
CONTEXT_FILE="/tmp/claude-context-$(basename $(pwd)).md"
cat > "$CONTEXT_FILE" << EOF
# Claude Code Context - $(basename $(pwd))
Last Updated: $(date)
PR Number: #<pr_number>
Issue: #<issue_number>
Branch: jeevanpillay/<feature_name>

## Todo State
- [ ] Task 1
- [ ] Task 2

## Current Focus
Working on: <current_task>

## Session Notes
<notes>
EOF

# 2. Make code changes
# ... implement features ...

# 3. CRITICAL: Local validation BEFORE commit
SKIP_ENV_VALIDATION=true bun run build  # MUST pass
bun run lint                             # MUST pass
bun run format                          # MUST pass

# 4. Update context and post comments
gh pr comment <pr_number> --body "🔧 Progress: <what_was_done>"
echo "Progress: <update>" >> "$CONTEXT_FILE"

# 5. Commit and push for Vercel testing
git add .
git commit -m "feat: <description>

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push -u origin jeevanpillay/<feature_name>
```

### Step 5: PR Creation & Testing

```bash
# Create PR and add to project
PR_URL=$(gh pr create --repo lightfastai/chat \
  --title "feat: <feature_name>" \
  --body "Closes #<issue_number>")
PR_NUM=$(echo $PR_URL | grep -oE "[0-9]+$")
gh project item-add 2 --owner lightfastai --url $PR_URL

# Monitor Vercel deployment
gh pr view $PR_NUM --json statusCheckRollup
# Test on Vercel preview URL (format: https://<project>-<pr-number>-<org>.vercel.app)
```

### Step 6: PR Merge & Cleanup

**CRITICAL**: Remove worktree BEFORE merging to prevent errors:
```bash
# Remove worktree first
git worktree remove worktrees/<feature_name>
cd /path/to/main/repo

# Merge PR
gh pr merge <pr_number> --squash --delete-branch

# Sync main branch
git checkout main
git pull origin main
git log --oneline -5  # Verify merge
```

## Tech Stack & Standards

### Core Technologies
- **Next.js 15** with App Router + Partial Prerendering (PPR)
- **Convex** for real-time database & API
- **Biome** for linting/formatting (NOT ESLint/Prettier)
- **shadcn/ui** components (New York style)
- **Tailwind CSS v4.x**
- **TypeScript** strict mode
- **Bun v1.2.10** runtime and package manager
- **Turborepo** for optimized builds

### Code Standards
- 2-space indentation, 80-character line width
- Double quotes for JSX and strings
- **YOU MUST** use Biome commands: `bun run lint`, `bun run format`
- Follow shadcn/ui patterns for components

### Branch Naming
**YOU MUST** use: `jeevanpillay/<feature_name>`

### Commit Format
```
<type>: <description>

<optional body>

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Critical Patterns

### Non-Blocking SSR with Convex
**YOU MUST** use this pattern for optimal performance:
```tsx
// ❌ NEVER do this (blocking)
export default async function Page() {
  const user = await getCurrentUser() // Blocks rendering
  return <Profile user={user} />
}

// ✅ ALWAYS do this (non-blocking)
export default async function Page() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <PageWithData />
    </Suspense>
  )
}

async function PageWithData() {
  const token = await getAuthToken()
  const preloadedUser = await preloadQuery(api.users.current, {}, { token })
  return <ProfileWithPreload preloadedUser={preloadedUser} />
}
```

### Client-Side Navigation
**YOU MUST** prefer client-side tabs over route-based navigation:
```tsx
// ✅ Client-side tabs with URL preservation
"use client"
export function TabsComponent() {
  const [activeTab, setActiveTab] = useState("profile")

  useEffect(() => {
    const path = activeTab === "api-keys" ? "/settings/api-keys" : "/settings"
    window.history.replaceState({}, "", path)
  }, [activeTab])

  return <Tabs value={activeTab} onValueChange={setActiveTab}>
    {/* Tab content */}
  </Tabs>
}
```

## Essential Commands

### Quality Gates (MUST pass before commit)
```bash
# Build validation
SKIP_ENV_VALIDATION=true bun run build

# Code quality
bun run lint
bun run format

# Environment sync
bun run env:sync
```

### Context Management
```bash
# Set context file
CONTEXT_FILE="/tmp/claude-context-$(basename $(pwd)).md"

# View context
cat "$CONTEXT_FILE"

# Update todo status
sed -i '' 's/\[ \] Task 1/\[x\] Task 1/' "$CONTEXT_FILE"
```

### GitHub Operations
```bash
# Create and link issue
gh issue create --repo lightfastai/chat
gh project item-add 2 --owner lightfastai --url <issue_url>

# Create and link PR
gh pr create --repo lightfastai/chat
gh project item-add 2 --owner lightfastai --url <pr_url>

# Monitor deployment
gh pr view <pr_number> --json statusCheckRollup
```

## Troubleshooting

### Common Issues
1. **Build failures**: Use `SKIP_ENV_VALIDATION=true bun run build`
2. **Merge conflicts**: Remove worktree first: `git worktree remove worktrees/<feature_name>`
3. **Context loss**: Check `/tmp/claude-context-*.md` files
4. **Deployment issues**: Monitor with `gh pr view <pr_number>`

### Quality Gate Failures
- **TypeScript errors**: Fix type issues before commit
- **Lint errors**: Run `bun run lint` to auto-fix
- **Build errors**: Check imports and environment variables

## Project Structure
```
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── components/     # React components (ui/, chat/, auth/)
│   └── lib/           # Utilities
├── convex/            # Backend functions
├── scripts/           # Development scripts
├── worktrees/         # Feature development (git worktrees)
└── CLAUDE.md         # This file
```

## Environment Variables
- `ANTHROPIC_API_KEY` - Claude Sonnet 4 (required)
- `OPENAI_API_KEY` - GPT models (required)
- `NEXT_PUBLIC_CONVEX_URL` - Backend URL (required)
- Optional: GitHub OAuth, JWT keys, SITE_URL

## Key Reminders

1. **WORKTREES ARE MANDATORY** - ANY code change requires a worktree, no exceptions
2. **NO LOCAL DEV SERVERS** - Test only on Vercel previews
3. **CONTEXT IS CRITICAL** - Always use context files and GitHub comments
4. **QUALITY GATES FIRST** - Build/lint must pass before commit
5. **WORKTREE CLEANUP** - Remove before merging to prevent errors
6. **USE TEMPLATES** - Always use issue templates with file references
7. **BIOME NOT ESLINT** - Use `bun run lint`, not ESLint commands
