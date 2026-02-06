# Accelerator Demo Script: Lightfast Cross-Source Intelligence

## Pre-Demo Setup (5 minutes before)

1. **Reset demo environment**:
   ```bash
   pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i
   ```

2. **Wait for indexing** (90-120 seconds):
   - Check Inngest at http://localhost:8288
   - All 17 workflows should show "completed"
   - Relationship edges should be visible in database

3. **Verify setup**:
   ```bash
   # Check relationship count
   curl -H "Authorization: Bearer <api_key>" \
     -H "X-Workspace-ID: <workspace_id>" \
     "http://localhost:4107/v1/graph/<any_obs_id>?depth=2"
   ```

4. **Open console search**:
   - Navigate to workspace search in console UI

---

## Demo Flow (5 minutes)

### Opening Hook (30 seconds)

> "Imagine it's 2 AM. You're on-call. Alerts are firing. Users can't checkout.
>
> You need to understand what's happening - but the information is scattered across Sentry, Linear, GitHub, and Vercel.
>
> Today, that means 10 minutes of context switching between 4 different tools.
>
> With Lightfast, you ask one question."

### Demo 1: The Incident Query (90 seconds)

**Search**: `What happened with the checkout TypeError?`

**Talk through results**:
> "Watch what comes back. One query - four sources.
>
> We have the **Sentry alert** that detected the error, the **Linear issue** tracking it, the **GitHub PR** that fixed it, and the **Vercel deployment** that shipped the fix.
>
> Notice the cross-source links - the PR explicitly says 'Fixes LIN-892' and 'Resolves CHECKOUT-123'. Lightfast understands these connections."

**Show relationship graph**:
> "Let me show you the relationship graph."
>
> Click on a result, call `/v1/graph/{id}`, show:
> - Sentry CHECKOUT-123 -> triggers -> Linear LIN-892
> - Linear LIN-892 <- fixes <- GitHub PR #478
> - GitHub PR #478 <- deploys <- Vercel deployment

### Demo 2: Expertise Query (45 seconds)

**Search**: `Who fixed the checkout bug?`

> "Lightfast doesn't just find documents - it understands who did what.
>
> Alice Chen fixed the bug. She's the PR author, the Linear assignee, and the one who resolved the Sentry issue.
>
> Charlie merged it. Next time there's a checkout issue at 2 AM, you know exactly who to call."

### Demo 3: Related Events (45 seconds)

**API call**: `GET /v1/related/{github_pr_id}`

> "Here's the power of the relationship graph.
>
> Starting from the PR, I can see all connected events: the Sentry issue that triggered the work, the Linear issue tracking it, and the Vercel deployment that shipped it.
>
> This is automatic - Lightfast builds the graph from webhook data."

### The Value Prop (30 seconds)

> "The core insight is simple: **Your engineering stack already has all the context.** It's just scattered across tools.
>
> Lightfast connects everything via webhooks, builds a relationship graph, and makes it all searchable.
>
> The more your team uses their normal tools, the smarter Lightfast gets."

### Closing (30 seconds)

> "We're building the universal search for engineering teams.
>
> Today we support GitHub and Vercel in production, with Sentry and Linear ready. The architecture supports any tool with webhooks.
>
> Our vision: Every tool becomes AI-searchable. Every incident has instant context. Every developer has a photographic memory of their stack."

---

## Q&A Preparation

**Q: How does it connect information across sources?**
> "We build a relationship graph. When a PR says 'Fixes LIN-892', we create an edge. When a Vercel deployment includes a commit SHA, we link it to the GitHub push. The graph materializes these relationships during ingestion, enabling fast traversal at query time."

**Q: Why build a graph instead of just searching?**
> "Search finds documents. The graph finds connections. When you're debugging an incident, you need to know: what triggered this? what fixed it? who deployed the fix? The graph answers these questions that pure text search can't."

**Q: What relationship types do you track?**
> "Eight types: fixes, resolves, triggers, deploys, references, same_commit, same_branch, and tracked_in. Each captures a specific engineering workflow pattern."

---

## Backup Queries

If primary queries don't return good results:
1. `LIN-892` - Direct entity search
2. `checkout bug fix` - Should return PR #478
3. `deployment merge478sha456` - Should return Vercel events
4. `alice chen checkout` - Should return Alice's contributions

---

## Troubleshooting

**No relationships appearing**:
- Check `lightfast_workspace_observation_relationships` table has rows
- Verify Inngest "detect-relationships" step completed
- Ensure demo data has cross-reference fields

**Graph API returning empty**:
- Verify observation ID exists
- Check workspace ID matches
- Try increasing depth parameter

**Search not returning cross-source results**:
- Verify all 17 events were ingested
- Check embeddings were generated (look for embedding IDs in observations)
- Wait longer for async processing to complete

---

## Technical Details

### Relationship Types Created

The demo data creates relationships via:
1. **Commit SHA matching**: `merge478sha456` links GitHub PR -> Vercel deployment
2. **Issue references**: PR body "Fixes LIN-892" links to Linear issue
3. **Sentry resolution**: `statusDetails.inCommit` links to GitHub merge
4. **Linear attachments**: GitHub PR #478 attachment links to Linear issue

### Expected Graph Structure

```
Sentry CHECKOUT-123 (error detected)
         |
         | triggers
         v
Linear LIN-892 (tracked issue)
         ^
         | fixes
         |
GitHub PR #478 (fix merged)
         ^
         | deploys
         |
Vercel deployment (fix shipped)
```

### API Endpoints

- **Search**: `POST /v1/search` - Returns results with `references` array
- **Graph**: `GET /v1/graph/{id}?depth=2` - BFS traversal of relationship graph
- **Related**: `GET /v1/related/{id}` - Direct connections only

### Database Tables

- `lightfast_workspace_neural_observations` - Source events
- `lightfast_workspace_neural_entities` - Extracted entities
- `lightfast_workspace_observation_relationships` - Typed edges between observations
- `lightfast_workspace_observation_clusters` - Topic clusters
