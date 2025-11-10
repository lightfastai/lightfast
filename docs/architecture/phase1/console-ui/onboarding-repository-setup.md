---
title: Onboarding & Repository Setup UX
description: End-to-end user flow for connecting repositories and setting up lightfast.yml configuration
status: proposed
owner: product + engineering
audience: engineering, design
last_updated: 2025-11-10
tags: [onboarding, ux, repository-setup, github-integration]
---

# Onboarding & Repository Setup UX

Complete UX specification for the repository connection and lightfast.yml configuration flow in Console.

---

## Executive Summary

**Goal:** Get users from "repo selected" to "docs indexed" in under 2 minutes with minimal friction.

**Approach:** Boilerplate-first configuration with automated PR creation.

**Key Decisions:**
- ✅ **Boilerplate config:** Single store indexing README.md (users customize later)
- ✅ **Automated PR:** GitHub App creates PR with lightfast.yml
- ✅ **No analysis:** Skip repo scanning, file detection, pattern matching
- ✅ **GitHub App permissions:** Use app bot (not separate bot account)
- ✅ **PR to main always:** No branch selection in MVP

---

## Design Philosophy

### Core Principles

1. **Get to Success Fast**
   - Boilerplate config that just works (indexes README.md)
   - User can customize later via GitHub
   - No configuration paralysis

2. **Automate Where Possible**
   - One-click PR creation (no manual copy-paste)
   - Graceful fallback to manual if needed
   - Clear next steps at every stage

3. **Familiar Patterns**
   - Follow Vercel/Railway UX patterns
   - Standard GitHub App bot workflow
   - Developers already understand this flow

4. **Progressive Disclosure**
   - Start simple (README only)
   - Show customization examples in comments
   - Link to docs for advanced usage

---

## User Flow Overview

```
┌─────────────────┐
│ 1. Select Repo  │  User browses their GitHub repos
└────────┬────────┘  Shows config status (✓ ready | ⚠️ setup needed)
         │
         ↓
    ┌────────┐
    │ Has    │────────Yes──────┐
    │ config?│                 ↓
    └────┬───┘           ┌─────────────┐
         │               │ 2A. Direct  │
         No              │   Connect   │
         │               └─────────────┘
         ↓
┌──────────────────┐
│ 2B. Setup Flow   │  Choose: PR creation or manual copy
└────────┬─────────┘
         │
    ┌────┴─────┐
    │  Method? │
    └────┬─────┘
         │
    ┌────┴────────────────┐
    │                     │
    ↓                     ↓
┌─────────────┐    ┌──────────────┐
│ 3A. Create  │    │ 3B. Manual   │
│    PR       │    │    Copy      │
└──────┬──────┘    └──────┬───────┘
       │                  │
       ↓                  ↓
┌─────────────┐    ┌──────────────┐
│ 4A. PR Link │    │ 4B. Wait for │
│   & Status  │    │   User Commit│
└──────┬──────┘    └──────┬───────┘
       │                  │
       └────────┬─────────┘
                ↓
       ┌────────────────┐
       │ 5. Webhook     │  User merges → ingestion starts
       │    Triggered   │
       └────────────────┘
```

**Time Estimate:**
- Select repo: 30s
- Setup flow: 30s
- Review & merge PR: 1min
- **Total: ~2 minutes**

---

## Step 1: Repository Selection

### UI Specification

**Location:** Dialog triggered from "Connect Repository" button

**Key Features:**
1. **Pre-check config status** (parallel API calls while loading repo list)
2. **Visual status badges** (✓ configured | ⚠️ setup needed)
3. **Single repo selection** (Phase 1 limitation)
4. **Search & filter** capabilities

### Wireframe

```
┌─────────────────────────────────────────────────────┐
│  Import Repository                                   │
├─────────────────────────────────────────────────────┤
│  🔍 Search repositories...                   [All ▼]│
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ 🟢 lightfastai/lightfast          ⭐ 42        ││
│  │ TypeScript • Private • Updated 2h ago          ││
│  │ ✓ Ready to index                               ││
│  │                                      [Import →]││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ 🔴 lightfastai/docs                 ⭐ 12       ││
│  │ MDX • Public • Updated 1d ago                  ││
│  │ ⚠️ Setup required                              ││
│  │                                      [Import →]││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ lightfastai/api                   ⭐ 8         ││
│  │ TypeScript • Private • Updated 3d ago          ││
│  │ ⚠️ Setup required                              ││
│  │                                      [Import →]││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  Missing a repo? [Configure GitHub App access →]    │
│                                                      │
│  [Cancel]                                            │
└─────────────────────────────────────────────────────┘
```

### Status Badge Logic

**Green (Ready):**
- `lightfast.yml` found in default branch
- Text: "✓ Ready to index"
- Color: Green indicator

**Amber (Setup Needed):**
- No `lightfast.yml` found
- Text: "⚠️ Setup required"
- Color: Amber indicator

### Implementation Notes

```typescript
// Check config status for each repo in parallel
const reposWithStatus = await Promise.all(
  repositories.map(async (repo) => {
    const hasConfig = await checkConfigExists(repo.full_name);
    return {
      ...repo,
      configStatus: hasConfig ? 'configured' : 'unconfigured'
    };
  })
);

// API endpoint
async function checkConfigExists(repoFullName: string): Promise<boolean> {
  const [owner, repo] = repoFullName.split('/');
  const octokit = await getOctokitForInstallation(installationId);

  try {
    await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'lightfast.yml',
      ref: 'main'  // or defaultBranch
    });
    return true;
  } catch (error) {
    return false;  // 404 = no config
  }
}
```

---

## Step 2A: Direct Connect (Has Config)

### UI Specification

**Trigger:** User clicks "Import" on repo with existing config

**Flow:**
1. Show preview of existing config
2. One-click connect
3. Redirect to repository settings

### Wireframe

```
┌─────────────────────────────────────────────────────┐
│  Configure lightfast                                 │
│  lightfastai/lightfast                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅ Configuration Found                              │
│                                                      │
│  We found lightfast.yml in your repository.         │
│  Ready to start indexing!                           │
│                                                      │
│  Preview:                                           │
│  ┌────────────────────────────────────────────────┐│
│  │ version: 1                                     ││
│  │ store: docs                                    ││
│  │ include:                                       ││
│  │   - "docs/**/*.md"                             ││
│  │   - "README.md"                                ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  📊 Indexing will start on the next push to main    │
│                                                      │
│  [< Back]                        [Connect & Index]  │
└─────────────────────────────────────────────────────┘
```

### Implementation

```typescript
const handleDirectConnect = async () => {
  // 1. Create ConnectedRepository record
  await connectMutation.mutate({
    organizationId,
    githubRepoId: repo.id,
    githubInstallationId: installationId,
    permissions: repo.permissions,
    metadata: { /* ... */ }
  });

  // 2. Trigger config detection
  await detectConfigMutation.mutate({
    repositoryId: newRepoId,
    organizationId
  });

  // 3. Show success toast
  toast({
    title: "Repository connected",
    description: "Indexing will start on next push to main"
  });

  // 4. Redirect to repo settings
  router.push(`/org/${orgSlug}/repositories/${newRepoId}`);
};
```

---

## Step 2B: Setup Flow (No Config)

### UI Specification

**Trigger:** User clicks "Import" on repo without config

**Key Elements:**
1. Explanation of what we'll create
2. Two setup methods (PR or manual)
3. Clear next steps

### Wireframe

```
┌─────────────────────────────────────────────────────┐
│  Configure lightfast                                 │
│  lightfastai/docs                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ⚠️ Setup Required                                   │
│                                                      │
│  No lightfast.yml found. We'll create one for you.  │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │  📄 We'll add a basic configuration:           ││
│  │                                                 ││
│  │  • Store name: docs                            ││
│  │  • Indexes: README.md                          ││
│  │                                                 ││
│  │  You can customize this later by editing       ││
│  │  lightfast.yml in your repository.             ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  How would you like to set this up?                 │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ ● Create pull request (recommended)            ││
│  │   We'll create a PR with lightfast.yml.        ││
│  │   Review and merge it to start indexing.       ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ ○ Copy configuration                            ││
│  │   I'll add lightfast.yml manually.              ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  [< Back]                                [Continue] │
└─────────────────────────────────────────────────────┘
```

### Boilerplate Configuration

```yaml
# Lightfast Configuration
# Docs: https://docs.lightfast.com/config

version: 1

# Store name (unique identifier for this repository's docs)
store: docs

# Files to index
include:
  - "README.md"

# Add more paths as needed:
# - "docs/**/*.md"
# - "docs/**/*.mdx"
# - "*.md"
```

**Why README.md:**
- ✅ Every repo has a README
- ✅ Instant success (file will be indexed)
- ✅ Clear examples for expansion
- ✅ No configuration decisions needed

---

## Step 3A: Create Pull Request

### UI Specification

**Flow:**
1. Show loading state
2. Create branch + commit + PR via GitHub App
3. Show success with PR link

### Wireframe (Loading)

```
┌─────────────────────────────────────────────────────┐
│  Creating Pull Request                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ⏳ Setting up your repository...                    │
│                                                      │
│  ✓ Creating branch                                  │
│  ⏳ Adding lightfast.yml                             │
│  ⏳ Creating pull request                            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Wireframe (Success)

```
┌─────────────────────────────────────────────────────┐
│  Pull Request Created                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅ Setup complete! Review the PR to continue.       │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │  📝 Pull Request #42                           ││
│  │  "🚀 Add Lightfast configuration"              ││
│  │                                                 ││
│  │  Review and merge this PR to start indexing   ││
│  │  your documentation.                           ││
│  │                                                 ││
│  │  [Open Pull Request on GitHub →]               ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  What happens next:                                 │
│  1. Review the PR on GitHub                         │
│  2. Merge to main branch                            │
│  3. We'll automatically start indexing              │
│                                                      │
│  ℹ️  Repository has been connected. You can view it │
│     in your repositories list.                      │
│                                                      │
│  [View Repositories]                  [Manual Sync] │
└─────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// API: apps/console/src/app/(github)/api/github/create-config-pr/route.ts

const BOILERPLATE_CONFIG = `# Lightfast Configuration
# Docs: https://docs.lightfast.com/config

version: 1

# Store name (unique identifier for this repository's docs)
store: docs

# Files to index
include:
  - "README.md"

# Add more paths as needed:
# - "docs/**/*.md"
# - "docs/**/*.mdx"
# - "*.md"
`;

const PR_BODY = `This PR adds a basic Lightfast configuration to enable documentation indexing.

## What's included

- Indexes your README.md file
- Creates a \`docs\` store for your documentation

## Next steps

1. Review and merge this PR
2. Your README will be automatically indexed
3. Customize \`lightfast.yml\` to index more files as needed

---

📚 [Configuration Documentation](https://docs.lightfast.com/config)
🤖 *Automatically created by [Lightfast Console](https://console.lightfast.com)*`;

export async function POST(request: NextRequest) {
  const { repository, installationId } = await request.json();
  const [owner, repo] = repository.split('/');

  // Get app installation token
  const octokit = await getOctokitForInstallation(installationId);

  const branchName = `lightfast/setup-${Date.now()}`;
  const mainBranch = 'main';

  try {
    // 1. Get main branch SHA
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${mainBranch}`
    });
    const mainSha = ref.object.sha;

    // 2. Create new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainSha
    });

    // 3. Create lightfast.yml file (branded commit)
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'lightfast.yml',
      message: 'Add Lightfast configuration\n\nAutomatically generated by Lightfast Console',
      content: Buffer.from(BOILERPLATE_CONFIG).toString('base64'),
      branch: branchName,
      committer: {
        name: 'Lightfast Bot',
        email: 'bot@lightfast.ai'
      },
      author: {
        name: 'Lightfast Bot',
        email: 'bot@lightfast.ai'
      }
    });

    // 4. Create PR
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: '🚀 Add Lightfast configuration',
      head: branchName,
      base: mainBranch,
      body: PR_BODY
    });

    return NextResponse.json({
      success: true,
      prUrl: pr.html_url,
      prNumber: pr.number
    });

  } catch (error) {
    console.error('Failed to create PR:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create pull request'
      },
      { status: 500 }
    );
  }
}
```

### Error Handling

**If PR creation fails:**
```typescript
try {
  await createConfigPR();
} catch (error) {
  // Fallback to manual copy
  toast({
    title: "Couldn't create PR automatically",
    description: "No worries! Copy the configuration manually instead.",
    variant: "default"
  });
  setSetupMethod('manual');
  setShowManualCopy(true);
}
```

---

## Step 3B: Manual Copy

### UI Specification

**Trigger:** User selects "Copy configuration" option

**Elements:**
1. Code block with config
2. Copy button
3. Instructions
4. "I've added the file" button

### Wireframe

```
┌─────────────────────────────────────────────────────┐
│  Configuration Ready                                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✓ Repository connected                              │
│  📋 Configuration generated                          │
│                                                      │
│  Next steps:                                        │
│  1. Copy the configuration below                    │
│  2. Create lightfast.yml in your repo root          │
│  3. Commit and push to main branch                  │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ # Lightfast Configuration         [📋 Copy]   ││
│  │ # Docs: https://docs.lightfast.com/config     ││
│  │                                                 ││
│  │ version: 1                                     ││
│  │                                                 ││
│  │ # Store name                                   ││
│  │ store: docs                                    ││
│  │                                                 ││
│  │ # Files to index                               ││
│  │ include:                                       ││
│  │   - "README.md"                                ││
│  │                                                 ││
│  │ # Add more paths as needed:                   ││
│  │ # - "docs/**/*.md"                             ││
│  │ # - "docs/**/*.mdx"                            ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  🔄 We'll detect your configuration automatically   │
│     once you push to main.                          │
│                                                      │
│  [< Back]                      [I've added the file]│
└─────────────────────────────────────────────────────┘
```

### Implementation

Uses existing `SetupGuideModal` component with minor updates:

```typescript
// In SetupGuideModal.tsx
export function SetupGuideModal({
  open,
  onOpenChange,
  repositoryName,
  onComplete  // New callback
}: SetupGuideModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(DEFAULT_CONFIG);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "lightfast.yml template has been copied."
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = () => {
    toast({
      title: "Configuration ready",
      description: "Push to main to start indexing."
    });
    onComplete?.();
  };

  // ... rest of component
}
```

---

## Step 4: Post-Setup States

### PR Created State

**Show in repository list:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ⏳ Setup in progress                                │
│                                                      │
│  Waiting for PR #42 to be merged                    │
│  [View Pull Request →]                              │
└─────────────────────────────────────────────────────┘
```

### Manual Setup State

**Show in repository list:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ⏳ Waiting for configuration                        │
│                                                      │
│  Push lightfast.yml to start indexing               │
│  [View Setup Guide →]                               │
└─────────────────────────────────────────────────────┘
```

### Configured State

**After PR merge or manual commit:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ✅ Ready to index                                   │
│                                                      │
│  Configuration detected                             │
│  Waiting for next push...                           │
└─────────────────────────────────────────────────────┘
```

---

## GitHub App Configuration

### Required Permissions

**Repository Permissions:**
```yaml
Contents: Read & Write       # Create files and commits
Pull requests: Read & Write  # Create PRs
Metadata: Read-only          # Auto-granted (repo info)
Webhooks: Read-only          # Receive push events
```

### Bot Identity

**PR Creator:**
- Shows as: `lightfast-console[bot]`
- Avatar: Lightfast logo (from app settings)
- Cannot be changed (GitHub standard)

**Commit Author (Customizable):**
```typescript
committer: {
  name: 'Lightfast Bot',
  email: 'bot@lightfast.ai'
}
```

**Result:**
- PR created by: `lightfast-console[bot]`
- Commit authored by: `Lightfast Bot <bot@lightfast.ai>`

### GitHub App vs Bot Account Decision

**We chose: GitHub App permissions** (NOT separate bot account)

**Reasoning:**

| Aspect | GitHub App | Bot Account |
|--------|-----------|-------------|
| User setup | ✅ One-step install | ❌ Install app + invite bot |
| Private repo access | ✅ Automatic | ❌ Manual per-repo invite |
| Permission management | ✅ Fine-grained | ❌ Broad PAT scope |
| Token expiration | ✅ Auto-refresh | ❌ Manual rotation |
| Security | ✅ Scoped to selected repos | ❌ PAT has wide access |
| Standard pattern | ✅ Vercel, Railway, etc. | ❌ Unusual |
| Future-proof | ✅ Request more perms | ❌ Limited flexibility |

**Real-world examples:**
- Vercel: Uses `vercel[bot]`
- Dependabot: Uses `dependabot[bot]`
- Renovate: Uses `renovate[bot]`

**Conclusion:** GitHub App bot is the industry standard and provides better UX.

---

## Implementation Checklist

### Phase 1: Repository Selection (Week 1)

- [ ] **API: Check config endpoint**
  - `GET /api/github/check-config?repo=owner/repo`
  - Returns: `{ exists: boolean }`

- [ ] **Update ConnectRepositoryDialog**
  - Add config status check on repo load
  - Show status badges (✓ ready | ⚠️ setup)
  - Route to different flows based on status

### Phase 2: Setup Flow (Week 2)

- [ ] **API: Create PR endpoint**
  - `POST /api/github/create-config-pr`
  - Body: `{ repository, installationId }`
  - Returns: `{ prUrl, prNumber }`

- [ ] **Create SetupFlowModal component**
  - Two-option UI (PR or manual)
  - Loading states
  - Success states with PR link

- [ ] **Update SetupGuideModal**
  - Add "I've added the file" callback
  - Improve copy button UX

### Phase 3: GitHub App Permissions (Week 2)

- [ ] **Update GitHub App settings**
  - Request `Contents: Write` permission
  - Request `Pull requests: Write` permission

- [ ] **Test permission flow**
  - Verify existing installations get prompt
  - Verify new installations see permissions

- [ ] **Test PR creation**
  - Public repos
  - Private repos
  - Organization repos

### Phase 4: Post-Setup States (Week 3)

- [ ] **Add repository status tracking**
  - `configStatus`: `pending` | `pr_created` | `manual_setup` | `configured`
  - Store PR URL/number if created

- [ ] **Update repository list UI**
  - Show different states
  - Add "View PR" / "View Setup Guide" links

- [ ] **Webhook config detection**
  - Detect when PR is merged
  - Update repository status
  - Trigger ingestion

### Phase 5: Testing & Polish (Week 3)

- [ ] **E2E testing**
  - Complete flow: select → setup → merge → index
  - Error scenarios
  - Permission failures

- [ ] **Error handling**
  - PR creation fails → fallback to manual
  - Permission denied → show helpful message
  - Network errors → retry logic

- [ ] **Analytics tracking**
  - Track setup method chosen
  - Track PR merge rate
  - Track time to first index

---

## Success Metrics

### Onboarding Funnel

```
Metric                          | Target
--------------------------------|--------
Repos selected                  | 100%
Setup method chosen (PR)        | 80%
PRs created successfully        | 95%
PRs merged within 1 hour        | 70%
First ingestion successful      | 90%
```

### Time to Value

**Target:** < 2 minutes from repo selection to PR created

**Breakdown:**
- Select repo: 30s
- Review setup screen: 20s
- Create PR: 10s (API call)
- Review PR on GitHub: 1min
- **Total: ~2 minutes**

### Quality Metrics

```
Metric                          | Target
--------------------------------|--------
PR creation success rate        | > 95%
Fallback to manual rate         | < 10%
User-reported setup issues      | < 5%
Repos with README indexed       | 100%
```

---

## Future Enhancements

### Phase 2: Smart Detection (Optional)

**If we want to add repo scanning later:**

```typescript
// Scan repo for common doc patterns
const patterns = await scanRepository(repo.full_name);

// Example patterns:
[
  { pattern: 'docs/**/*.md', fileCount: 15, confidence: 0.9 },
  { pattern: 'content/**/*.mdx', fileCount: 8, confidence: 0.85 },
  { pattern: 'README.md', fileCount: 1, confidence: 1.0 }
]

// Pre-populate config with detected patterns
const config = generateConfig({
  store: 'docs',
  include: patterns.filter(p => p.confidence > 0.8).map(p => p.pattern)
});
```

**When to add this:**
- After validating boilerplate approach works
- If users request more intelligent defaults
- If we see high customization rate

### Phase 2: In-App Config Editor

**Allow editing lightfast.yml via Console UI:**
- Visual editor for common patterns
- Live file count preview
- Creates PR with config changes
- Maintains GitHub as source of truth

### Phase 2: Batch Repository Setup

**Allow connecting multiple repos at once:**
- Select multiple repos from list
- Apply boilerplate config to all
- Create PRs in parallel
- Show batch progress

### Phase 3: Advanced Patterns

**Support more complex configurations:**
- Exclude patterns
- Custom metadata extraction
- Multiple stores per repo
- Conditional indexing

---

## Open Questions

### Q1: Default branch detection

**Question:** What if repo doesn't use `main` as default branch?

**Answer:** Use GitHub API to get default branch:
```typescript
const { data: repo } = await octokit.rest.repos.get({ owner, repo });
const defaultBranch = repo.default_branch;  // Use this instead of hardcoding 'main'
```

### Q2: PR already exists

**Question:** What if PR already exists on the branch?

**Answer:** Check before creating:
```typescript
// Check if PR exists
const { data: prs } = await octokit.rest.pulls.list({
  owner,
  repo,
  head: `${owner}:lightfast/setup-*`,
  state: 'open'
});

if (prs.length > 0) {
  return { prUrl: prs[0].html_url, prNumber: prs[0].number };
}
```

### Q3: Config file exists but not indexed

**Question:** What if lightfast.yml exists but repo not connected?

**Answer:** Show "Re-connect" option:
```
✓ Configuration found
⚠️ Repository not connected
[Re-connect Repository]
```

### Q4: User doesn't have merge permissions

**Question:** What if user can't merge PR?

**Answer:** Show helpful message:
```
PR created successfully!

Note: You don't have permission to merge this PR.
Ask a repository admin to review and merge.

[Copy PR link to share]
```

---

## Appendix: Example PR

### What Users See on GitHub

**PR Title:**
```
🚀 Add Lightfast configuration
```

**PR Description:**
```markdown
This PR adds a basic Lightfast configuration to enable documentation indexing.

## What's included

- Indexes your README.md file
- Creates a `docs` store for your documentation

## Next steps

1. Review and merge this PR
2. Your README will be automatically indexed
3. Customize `lightfast.yml` to index more files as needed

---

📚 [Configuration Documentation](https://docs.lightfast.com/config)
🤖 *Automatically created by [Lightfast Console](https://console.lightfast.com)*
```

**Files Changed:**
```diff
+ lightfast.yml
```

**Commit Message:**
```
Add Lightfast configuration

Automatically generated by Lightfast Console
```

**Commit Author:**
```
Lightfast Bot <bot@lightfast.ai>
```

**PR Creator:**
```
lightfast-console[bot]
```

---

## Related Documentation

- [User Flow Architecture](../user-flow-architecture.md) - Complete onboarding flow
- [GitHub API Strategy](../github-api-strategy.md) - File fetching and rate limits
- [DX Configuration](../dx-configuration.md) - lightfast.yml specification
- [UI Structure](./ui-structure.md) - Console UI organization

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Status:** Proposed - Ready for Implementation
**Next Steps:** Review → Approve → Implement Week 1 (Repository Selection)
