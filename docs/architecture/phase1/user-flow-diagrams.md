---
title: User Onboarding Flow - Visual Diagrams
description: ASCII diagrams illustrating the architecture and flows
status: proposed
owner: product
audience: all
last_updated: 2025-11-07
tags: [onboarding, diagrams]
---

# User Onboarding Flow - Visual Diagrams

Visual representations of the architecture and flows described in [user-flow-architecture.md](./user-flow-architecture.md).

---

## 1. Complete System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   GitHub    │  │    Clerk    │  │  Pinecone   │  │   OpenAI    │   │
│  │             │  │             │  │             │  │             │   │
│  │  • OAuth    │  │  • Auth     │  │  • Vectors  │  │  • Embed    │   │
│  │  • App API  │  │  • Orgs     │  │  • Search   │  │  • Models   │   │
│  │  • Webhooks │  │  • Users    │  │             │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          │                │                │                │
┌─────────▼────────────────▼────────────────▼────────────────▼───────────┐
│                         LIGHTFAST CONSOLE APP                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        FRONTEND (Next.js)                        │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  Authentication          Onboarding            Organization     │  │
│  │  ┌─────────────┐        ┌─────────────┐       ┌─────────────┐  │  │
│  │  │  Sign Up    │  →     │  Connect    │  →    │  Dashboard  │  │  │
│  │  │  Sign In    │        │  GitHub     │       │  Repos      │  │  │
│  │  └─────────────┘        │  Claim Org  │       │  Stores     │  │  │
│  │                         └─────────────┘       │  Search     │  │  │
│  │                                                └─────────────┘  │  │
│  │                                                                  │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
│                               │ tRPC                                    │
│                               │                                         │
│  ┌────────────────────────────▼─────────────────────────────────────┐  │
│  │                      BACKEND (tRPC API)                          │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  Routers:                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │  │
│  │  │  Organization   │  │  Repository     │  │  Store         │  │  │
│  │  │                 │  │                 │  │                │  │  │
│  │  │  • claim        │  │  • list         │  │  • list        │  │  │
│  │  │  • find         │  │  • connect      │  │  • search      │  │  │
│  │  │  • update       │  │  • configure    │  │  • documents   │  │  │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘  │  │
│  │                                                                  │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
│                               │                                         │
│  ┌────────────────────────────▼─────────────────────────────────────┐  │
│  │                    WEBHOOK HANDLERS                              │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  GitHub Events:                                                  │  │
│  │  • push                    → Trigger ingestion                   │  │
│  │  • installation.deleted    → Mark repos inactive                 │  │
│  │  • repository.deleted      → Mark repo deleted                   │  │
│  │  • repository.renamed      → Update metadata                     │  │
│  │                                                                  │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
│                               │ Inngest Events                          │
│                               │                                         │
│  ┌────────────────────────────▼─────────────────────────────────────┐  │
│  │                  INGESTION PIPELINE (Inngest)                    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  Workflow: docs-ingestion                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │
│  │  │  Fetch   │→ │  Parse   │→ │  Chunk   │→ │  Embed   │       │  │
│  │  │  Files   │  │  Markdown│  │  Content │  │  & Index │       │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │  │
│  │       ↓             ↓             ↓             ↓               │  │
│  │  Changed Files  Frontmatter   Chunks       Vectors              │  │
│  │                                                                  │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                │ Store
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                           DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────┐      ┌────────────────────────┐            │
│  │   MySQL (PlanetScale)  │      │  Postgres (PlanetScale)│            │
│  ├────────────────────────┤      ├────────────────────────┤            │
│  │                        │      │                        │            │
│  │  • organizations       │      │  • lf_stores           │            │
│  │  • connected_repos     │      │  • lf_docs_documents   │            │
│  │                        │      │  • lf_vector_entries   │            │
│  │                        │      │  • lf_ingestion_commits│            │
│  │                        │      │                        │            │
│  └────────────────────────┘      └────────────────────────┘            │
│                                                                          │
│  ┌────────────────────────┐                                             │
│  │  Pinecone Vector DB    │                                             │
│  ├────────────────────────┤                                             │
│  │                        │                                             │
│  │  Namespaces:           │                                             │
│  │  ws_orgslug__store_*   │                                             │
│  │                        │                                             │
│  │  • Document chunks     │                                             │
│  │  • Embeddings          │                                             │
│  │  • Metadata            │                                             │
│  │                        │                                             │
│  └────────────────────────┘                                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌──────────────┐                                                       │
│  │   User       │    Clerk manages authentication                       │
│  │   (Clerk)    │    and organization membership                        │
│  ├──────────────┤                                                       │
│  │ userId       │                                                       │
│  │ email        │                                                       │
│  └──────┬───────┘                                                       │
│         │ member of                                                     │
│         │                                                               │
│         │ N:N                                                           │
│         │                                                               │
│  ┌──────▼──────────┐      1:1      ┌──────────────────────┐           │
│  │  Organization   ├───────links───►│   Organization       │           │
│  │  (Clerk)        │                │   (Lightfast)        │           │
│  ├─────────────────┤                ├──────────────────────┤           │
│  │ clerkOrgId      │◄───────────────┤ id                   │           │
│  │ clerkOrgSlug    │                │ clerkOrgId    [UNIQ] │           │
│  │ members[]       │                │ githubOrgId   [UNIQ] │           │
│  │ roles[]         │                │ githubInstallationId │           │
│  └─────────────────┘                │ githubOrgSlug        │           │
│                                     │ githubOrgName        │           │
│                                     │ claimedBy            │           │
│                                     └──────────┬───────────┘           │
│                                                │                        │
│                                                │ 1:1 implicit           │
│                                                │                        │
│                                     ┌──────────▼───────────┐           │
│                                     │   Workspace          │           │
│                                     │   (Virtual/Computed) │           │
│                                     ├──────────────────────┤           │
│                                     │ workspaceId          │           │
│                                     │   = ws_${orgSlug}    │           │
│                                     └──────────┬───────────┘           │
│                                                │                        │
│                              ┌─────────────────┼───────────────────┐   │
│                              │ 1:N             │ 1:N               │   │
│                              │                 │                   │   │
│                   ┌──────────▼─────────┐  ┌───▼───────────────┐   │   │
│                   │  ConnectedRepo     │  │  Store            │   │   │
│                   ├────────────────────┤  ├───────────────────┤   │   │
│                   │ id                 │  │ id                │   │   │
│                   │ organizationId [FK]│  │ workspaceId       │   │   │
│                   │ githubRepoId [UNIQ]│  │ name              │   │   │
│                   │ githubInstallId    │  │ indexName         │   │   │
│                   │ isActive           │  └────────┬──────────┘   │   │
│                   │ permissions        │           │              │   │
│                   │ metadata           │           │ 1:N          │   │
│                   └────────┬───────────┘           │              │   │
│                            │                       │              │   │
│                            │ contains          ┌───▼───────────┐  │   │
│                            │                   │  Document     │  │   │
│                            │                   ├───────────────┤  │   │
│                   ┌────────▼───────────┐       │ id            │  │   │
│                   │  lightfast.yml     │       │ storeId   [FK]│  │   │
│                   ├────────────────────┤       │ path          │  │   │
│                   │ version: 1         │       │ slug          │  │   │
│                   │ store: docs-site   │       │ title         │  │   │
│                   │ include:           │       │ contentHash   │  │   │
│                   │   - docs/**/*.md   │       │ commitSha     │  │   │
│                   └────────────────────┘       └────────┬──────┘  │   │
│                                                         │         │   │
│                                                         │ 1:N     │   │
│                                                         │         │   │
│                                                  ┌──────▼──────┐  │   │
│                                                  │ VectorEntry │  │   │
│                                                  ├─────────────┤  │   │
│                                                  │ id (vectorId)  │   │
│                                                  │ storeId  [FK]  │   │
│                                                  │ docId    [FK]  │   │
│                                                  │ chunkIndex     │   │
│                                                  │ contentHash    │   │
│                                                  │ indexName      │   │
│                                                  └────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

Constraints:
• (workspaceId, storeName) UNIQUE - one store name per workspace
• (storeId, path) UNIQUE - one document per path per store
• githubOrgId UNIQUE - one Lightfast org per GitHub org
• githubRepoId UNIQUE - one connected repo record per GitHub repo
• clerkOrgId UNIQUE - one Clerk org per Lightfast org
```

---

## 3. User Onboarding Flow Sequence

```
┌──────┐                  ┌─────────┐         ┌────────┐         ┌──────────┐
│ User │                  │ Console │         │ Clerk  │         │  GitHub  │
└──┬───┘                  └────┬────┘         └───┬────┘         └────┬─────┘
   │                           │                  │                   │
   │  1. Visit /sign-up        │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  Create account  │                   │
   │                           ├─────────────────►│                   │
   │                           │  ◄────────────────                   │
   │  ◄────────────────────────┤  userId          │                   │
   │   Session: AUTHENTICATED  │                  │                   │
   │                           │                  │                   │
   │  2. Connect GitHub        │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  OAuth redirect  │                   │
   │                           ├─────────────────────────────────────►│
   │  ◄───────────────────────────────────────────────────────────────┤
   │   Authorize app           │                  │   GitHub login    │
   ├──────────────────────────────────────────────────────────────────►
   │                           │                  │  ◄─────────────────
   │                           │  ◄─────────────────────────────────────
   │  ◄────────────────────────┤  access_token    │   Code            │
   │   github_user_token       │                  │                   │
   │                           │                  │                   │
   │  3. Claim Organization    │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  List installations                  │
   │                           ├─────────────────────────────────────►│
   │  ◄────────────────────────┤  ◄─────────────────────────────────────
   │   Show orgs               │  Installations[] │                   │
   │                           │                  │                   │
   │  Select org + Claim       │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  Create Clerk org│                   │
   │                           ├─────────────────►│                   │
   │                           │  ◄────────────────                   │
   │                           │  clerkOrgId      │                   │
   │                           │                  │                   │
   │                           │  Create Lightfast org (DB)           │
   │                           │  Link clerkOrgId ↔ githubOrgId       │
   │                           │                  │                   │
   │                           │  Set active org  │                   │
   │                           ├─────────────────►│                   │
   │  ◄────────────────────────┤  ◄────────────────                   │
   │   Session: ACTIVE         │                  │                   │
   │   Redirect to dashboard   │                  │                   │
   │                           │                  │                   │
   │  4. Connect Repository    │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  List repos      │                   │
   │                           ├─────────────────────────────────────►│
   │  ◄────────────────────────┤  ◄─────────────────────────────────────
   │   Show repos              │  Repositories[]  │                   │
   │                           │                  │                   │
   │  Select repos + Connect   │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  Create ConnectedRepository (DB)     │
   │                           │  Check for lightfast.yml             │
   │                           ├─────────────────────────────────────►│
   │  ◄────────────────────────┤  ◄─────────────────────────────────────
   │   Status: Configured ✓    │  File exists     │                   │
   │                           │                  │                   │
   │  5. Push to main          │                  │                   │
   ├──────────────────────────────────────────────────────────────────►
   │                           │  Webhook: push   │                   │
   │                           │  ◄─────────────────────────────────────
   │                           │                  │                   │
   │                           │  Fetch lightfast.yml                 │
   │                           ├─────────────────────────────────────►│
   │                           │  ◄─────────────────────────────────────
   │                           │  Config YAML     │                   │
   │                           │                  │                   │
   │                           │  Trigger Inngest workflow (async)    │
   │                           │  → Fetch files   │                   │
   │                           │  → Parse markdown                    │
   │                           │  → Chunk content                     │
   │                           │  → Embed with OpenAI                 │
   │                           │  → Index to Pinecone                 │
   │                           │  → Save to Postgres                  │
   │                           │                  │                   │
   │  6. Search docs           │                  │                   │
   ├──────────────────────────►│                  │                   │
   │                           │  Query Pinecone (vector search)      │
   │                           │  Hydrate from Postgres               │
   │  ◄────────────────────────┤                  │                   │
   │   Results with sources    │                  │                   │
   │                           │                  │                   │
```

---

## 4. Workspace Resolution Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   WEBHOOK RECEIVES PUSH EVENT                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ {
                             │   repository: { id: 123456 },
                             │   ref: "refs/heads/main",
                             │   commits: [...]
                             │ }
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  1. LOOKUP REPOSITORY                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SELECT * FROM connected_repository                              │
│  WHERE githubRepoId = '123456' AND isActive = true               │
│                                                                  │
│  → result: {                                                     │
│      id: 'repo_abc',                                             │
│      organizationId: 'org_xyz'                                   │
│    }                                                             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  2. LOOKUP ORGANIZATION                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SELECT * FROM organizations                                     │
│  WHERE id = 'org_xyz'                                            │
│                                                                  │
│  → result: {                                                     │
│      id: 'org_xyz',                                              │
│      githubOrgSlug: 'lightfastai',                              │
│      githubInstallationId: 789                                   │
│    }                                                             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  3. COMPUTE WORKSPACE                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  workspaceId = `ws_${org.githubOrgSlug}`                        │
│              = `ws_lightfastai`                                 │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  4. FETCH LIGHTFAST.YML                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET /repos/{owner}/{repo}/contents/lightfast.yml                │
│  Headers: Authorization: Bearer {installation_token}             │
│                                                                  │
│  → result: {                                                     │
│      version: 1,                                                 │
│      store: 'docs-site',                                         │
│      include: ['docs/**/*.md']                                   │
│    }                                                             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  5. TRIGGER INGESTION                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  inngest.send({                                                  │
│    name: 'apps-console/docs.push',                               │
│    data: {                                                       │
│      workspaceId: 'ws_lightfastai',   ← COMPUTED                │
│      storeName: 'docs-site',          ← FROM CONFIG             │
│      beforeSha: 'abc123',                                        │
│      afterSha: 'def456',                                         │
│      changedFiles: [...]                                         │
│    }                                                             │
│  })                                                              │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  6. INNGEST WORKFLOW                                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  // Get or create store                                          │
│  store = await getOrCreateStore({                                │
│    workspaceId: 'ws_lightfastai',                               │
│    name: 'docs-site'                                             │
│  })                                                              │
│  // → storeId: 'store_123'                                       │
│  // → indexName: 'ws_lightfastai__store_docs-site'              │
│                                                                  │
│  // Process each file                                            │
│  for (file of changedFiles) {                                    │
│    content = fetchFile(file)                                     │
│    chunks = chunkMarkdown(content)                               │
│    vectors = embed(chunks)                                       │
│    upsert(pinecone, vectors, indexName)                          │
│    upsert(postgres, docs, storeId)                               │
│  }                                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Multi-User Organization Flow

```
SCENARIO 1: FIRST USER CLAIMS ORGANIZATION
═══════════════════════════════════════════

User A                   Console                   Clerk
  │                         │                        │
  │  Claim org              │                        │
  ├────────────────────────►│                        │
  │                         │  Create Clerk org      │
  │                         ├───────────────────────►│
  │                         │  ◄──────────────────────
  │                         │  clerkOrgId            │
  │                         │  User A = admin        │
  │                         │                        │
  │                         │  Create Lightfast org  │
  │                         │  (in MySQL)            │
  │                         │  {                     │
  │                         │    githubOrgId: 123,   │
  │                         │    clerkOrgId: org_A,  │
  │                         │    claimedBy: userA    │
  │                         │  }                     │
  │                         │                        │
  │  ◄─────────────────────┤                        │
  │  Success! Now admin     │                        │
  │                         │                        │


SCENARIO 2: SECOND USER JOINS EXISTING ORGANIZATION
════════════════════════════════════════════════════

User B                   Console                   Clerk          GitHub
  │                         │                        │              │
  │  Claim org              │                        │              │
  ├────────────────────────►│                        │              │
  │                         │  Find existing org     │              │
  │                         │  (by githubOrgId)      │              │
  │                         │  ✓ Found: org_xyz      │              │
  │                         │                        │              │
  │                         │  Verify GitHub membership             │
  │                         ├──────────────────────────────────────►│
  │                         │  ◄─────────────────────────────────────
  │                         │  { role: "member" }    │              │
  │                         │                        │              │
  │                         │  Add to Clerk org      │              │
  │                         ├───────────────────────►│              │
  │                         │  ◄──────────────────────              │
  │                         │  User B = member       │              │
  │                         │                        │              │
  │  ◄─────────────────────┤                        │              │
  │  Success! Now member    │                        │              │
  │                         │                        │              │


SCENARIO 3: USER WITH MULTIPLE ORGANIZATIONS
═════════════════════════════════════════════

User C has access to:
  • Org A (member)
  • Org B (admin)
  • Org C (admin)

┌──────────────────────────────────────────────────────────────────┐
│  Console UI                                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Logo]  [ Org A ▼ ]  Search...  [User C ▼]                    │
│                │                                                 │
│                └──► Dropdown:                                    │
│                      • Org A (member)    ←── Active             │
│                      • Org B (admin)                            │
│                      • Org C (admin)                            │
│                      ─────────────────                          │
│                      + Claim organization                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

When user switches org:
1. Clerk session updates active organization
2. All queries filtered by new clerkOrgId
3. UI shows repos/stores for new workspace
4. No data leakage between organizations
```

---

## 6. Store and Document Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WORKSPACE ISOLATION                          │
│                       ws_lightfastai                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STORE: docs-site                                             │ │
│  │  indexName: ws_lightfastai__store_docs-site                   │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │                                                               │ │
│  │  Repository: lightfastai/website                              │ │
│  │  Config: lightfast.yml                                        │ │
│  │    • store: docs-site                                         │ │
│  │    • include: docs/**/*.md                                    │ │
│  │                                                               │ │
│  │  Documents:                                                   │ │
│  │  ┌───────────────────────────────────────────────────────┐  │ │
│  │  │  docs/getting-started.md                              │  │ │
│  │  │  - slug: getting-started                              │  │ │
│  │  │  - chunks: 3                                          │  │ │
│  │  │  - vectors: doc_001#0, doc_001#1, doc_001#2          │  │ │
│  │  └───────────────────────────────────────────────────────┘  │ │
│  │  ┌───────────────────────────────────────────────────────┐  │ │
│  │  │  docs/api/authentication.md                           │  │ │
│  │  │  - slug: api/authentication                           │  │ │
│  │  │  - chunks: 5                                          │  │ │
│  │  │  - vectors: doc_002#0 ... doc_002#4                  │  │ │
│  │  └───────────────────────────────────────────────────────┘  │ │
│  │                                                               │ │
│  │  Total: 47 documents, 234 chunks                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STORE: api-docs                                              │ │
│  │  indexName: ws_lightfastai__store_api-docs                    │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │                                                               │ │
│  │  Repository: lightfastai/api                                  │ │
│  │  Config: lightfast.yml                                        │ │
│  │    • store: api-docs                                          │ │
│  │    • include: docs/api/**/*.md                                │ │
│  │                                                               │ │
│  │  Documents:                                                   │ │
│  │  ┌───────────────────────────────────────────────────────┐  │ │
│  │  │  docs/api/v1/search.md                                │  │ │
│  │  │  - slug: v1/search                                    │  │ │
│  │  │  - chunks: 4                                          │  │ │
│  │  └───────────────────────────────────────────────────────┘  │ │
│  │                                                               │ │
│  │  Total: 23 documents, 112 chunks                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Search scope:                                                      │
│  • /v1/search?filters.labels=["store:docs-site"]                   │
│  • /v1/search?filters.labels=["store:api-docs"]                    │
│  • Cross-store: workspaceId filter                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Configuration Wizard Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1: Select Repository                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️ lightfast.yml not found in lightfastai/docs-site           │
│                                                                  │
│  [ Configure Now ]  [ Skip ]                                     │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Click Configure
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2: Name Your Store                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Store Name: ┌────────────────────────────────────┐             │
│              │ docs-site                          │             │
│              └────────────────────────────────────┘             │
│                                                                  │
│  This name identifies your documentation in search results.      │
│  You can have multiple stores per workspace.                     │
│                                                                  │
│  [ Back ]  [ Next ]                                              │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3: Select Content                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  What should we index?                                           │
│  ☑ Documentation files (*.md, *.mdx)                            │
│  ☑ README files                                                 │
│  ☐ API specs (*.yaml, *.json)                                   │
│  ☐ Custom patterns (advanced)                                   │
│                                                                  │
│  [ Back ]  [ Next ]                                              │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 4: Specify Paths (Optional)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Include patterns:                                               │
│  ┌──────────────────────────────────────┐  [Remove]            │
│  │ docs/**/*.md                         │                       │
│  └──────────────────────────────────────┘                       │
│  ┌──────────────────────────────────────┐  [Remove]            │
│  │ apps/docs/content/**/*.mdx           │                       │
│  └──────────────────────────────────────┘                       │
│  [ + Add Pattern ]                                               │
│                                                                  │
│  Leave empty to index all matching file types.                   │
│                                                                  │
│  [ Back ]  [ Preview ]                                           │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 5: Preview                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔍 Found 47 matching files in main branch:                     │
│                                                                  │
│  ✓ docs/getting-started.md                                      │
│  ✓ docs/installation.md                                         │
│  ✓ docs/api/authentication.md                                   │
│  ✓ apps/docs/content/guides/intro.mdx                           │
│  ... (43 more)                                                   │
│                                                                  │
│  Generated configuration:                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ version: 1                                               │  │
│  │ store: docs-site                                         │  │
│  │ include:                                                 │  │
│  │   - docs/**/*.md                                         │  │
│  │   - apps/docs/content/**/*.mdx                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ Back ]  [ Generate Config ]                                   │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6: Commit Configuration                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  How would you like to add lightfast.yml to your repository?    │
│                                                                  │
│  ○ Create a pull request (recommended)                           │
│    We'll create a PR with the configuration file.               │
│    You can review and merge it.                                  │
│                                                                  │
│  ○ Commit directly to main                                       │
│    Configuration will be added immediately.                      │
│    (Requires push permission)                                    │
│                                                                  │
│  ○ Copy to clipboard                                             │
│    I'll add the file manually.                                   │
│                                                                  │
│  [ Back ]  [ Continue ]                                          │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 7: Success!                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ Configuration added successfully!                            │
│                                                                  │
│  Pull request created:                                           │
│  🔗 lightfastai/docs-site#123                                   │
│                                                                  │
│  Next steps:                                                     │
│  1. Review and merge the PR                                      │
│  2. Push to main branch                                          │
│  3. Ingestion will start automatically                           │
│                                                                  │
│  [ View PR ]  [ Back to Repositories ]                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Ingestion Pipeline Detail

```
┌─────────────────────────────────────────────────────────────────────┐
│                       INGESTION PIPELINE (Inngest)                   │
└─────────────────────────────────────────────────────────────────────┘

TRIGGER: push event → webhook → inngest.send()

┌──────────────────┐
│  1. VALIDATE     │
│                  │  Check workspaceId, storeName, changedFiles
│  Input:          │  Ensure store config is valid
│  - workspaceId   │
│  - storeName     │
│  - changedFiles  │
│  - beforeSha     │
│  - afterSha      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  2. GET/CREATE   │
│     STORE        │  SELECT * FROM lf_stores
│                  │  WHERE workspaceId = ? AND name = ?
│  Result:         │
│  - storeId       │  If not exists: INSERT INTO lf_stores
│  - indexName     │  indexName = ws_${workspace}__store_${name}
└────────┬─────────┘
         │
         │  for each changed file:
         ▼
┌──────────────────┐
│  3. FETCH FILE   │
│                  │  GitHub API: GET /repos/{owner}/{repo}/contents/{path}
│  Input: path     │  Using installation token
│  Output: content │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  4. PARSE        │
│    MARKDOWN      │  1. Extract frontmatter (YAML)
│                  │  2. Parse markdown to AST
│  Input: content  │  3. Extract title, description
│  Output:         │  4. Generate slug from path
│  - frontmatter   │  5. Compute contentHash (SHA-256)
│  - title         │
│  - description   │
│  - slug          │
│  - contentHash   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  5. CHUNK        │
│    CONTENT       │  Semantic chunking strategy:
│                  │  • Split by headers (h1, h2, h3)
│  Input: markdown │  • Max 1000 tokens per chunk
│  Output:         │  • Overlap 100 tokens
│  - chunks[]      │  • Preserve code blocks
│    - text        │
│    - index       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  6. EMBED        │
│    CHUNKS        │  OpenAI API: text-embedding-3-small
│                  │  • Batch embed (max 100 chunks)
│  Input: chunks   │  • 1536 dimensions
│  Output:         │  • Retry on rate limit
│  - vectors[]     │
│    - embedding   │
│    - metadata    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  7. UPSERT       │
│    VECTORS       │  Pinecone:
│                  │  • namespace = indexName
│  Pinecone:       │  • vectorId = ${docId}#${chunkIndex}
│  - upsert to     │  • metadata: { docId, chunkIndex, path, slug }
│    namespace     │
│                  │  Postgres:
│  Postgres:       │  • INSERT INTO lf_vector_entries
│  - save vector   │    (id, storeId, docId, chunkIndex, contentHash)
│    entry records │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  8. UPDATE DOC   │
│                  │  Postgres:
│  Postgres:       │  • UPSERT INTO lf_docs_documents
│  - upsert doc    │    (storeId, path, slug, title, description,
│    record         │     contentHash, commitSha, chunkCount)
│                  │
└────────┬─────────┘
         │
         ▼  all files processed
┌──────────────────┐
│  9. RECORD       │
│    INGESTION     │  INSERT INTO lf_ingestion_commits
│                  │  (storeId, beforeSha, afterSha, deliveryId,
│  Status: SUCCESS │   status, processedAt)
│                  │
└──────────────────┘

ERROR HANDLING:
• Network errors → Retry with exponential backoff (3x)
• Parse errors → Skip file, log error, continue
• Rate limits → Wait and retry
• Critical failures → Mark status as 'failed', notify user
```

---

These diagrams provide visual representations of the key concepts and flows in the user onboarding architecture. For implementation details, see [user-flow-architecture.md](./user-flow-architecture.md).
