---
date: 2026-03-18T00:00:00+00:00
researcher: claude
git_commit: 1581d9e1aed547ec49dd02499c9978a7ea8206b4
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Low-level architecture redesign: 2-app + connection-core mapped from current codebase"
tags: [research, architecture, platform, redesign, mermaid, low-level, relay, gateway, backfill, console, connection-core]
status: complete
last_updated: 2026-03-18
---

# Low-Level Architecture Redesign: 2-App + connection-core

**Date**: 2026-03-18
**Git Commit**: 1581d9e1aed547ec49dd02499c9978a7ea8206b4
**Branch**: refactor/define-ts-provider-redesign

## Research Question

Map every piece of current codebase functionality (relay, gateway, backfill, console) to the new 2-app model (apps/platform + apps/console + @repo/connection-core) described in `thoughts/shared/research/2026-03-17-infrastructure-redesign.md`, producing detailed Mermaid diagrams showing the full low-level design.

---

## Summary

The current system has 4 deployment units (relay, gateway, backfill, console). The redesign collapses this to 2 (platform, console) plus a new shared package. Every route, workflow step, DB write, Redis key, and Inngest function from the current system has a 1-to-1 mapping in the new design — nothing is deleted, only reorganised. The single structural innovation is that lifecycle event handling moves in-process with webhook routing, closing the race window between routing and teardown.

---

## Current Architecture Overview

```mermaid
flowchart TD
    EXT["External World\nGitHub · Vercel · Linear · Sentry\n(webhooks + OAuth)"]
    CLI["CLI / Browser\n(OAuth flows)"]

    EXT -->|"POST /api/webhooks/:provider"| RELAY
    CLI -->|"GET /services/gateway/:p/authorize"| GATEWAY

    subgraph relay["apps/relay  (port 4108)"]
        R1["HMAC verify"]
        R2["rawBodyCapture"]
        R3["Upstash Workflow\nwebhook-delivery\n5 steps"]
        R1 --> R2 --> R3
    end

    subgraph gateway["apps/gateway  (port 4110)"]
        G1["OAuth flows\n/authorize /callback /poll"]
        G2["Token vault\n/token/:id"]
        G3["Proxy\n/proxy/:id"]
        G4["Resource CRUD\n/connect/:id/resources"]
        G5["Upstash Workflow\nconnection-teardown\n4 steps"]
    end

    subgraph backfill["apps/backfill  (port 4109)"]
        B1["POST /api/trigger"]
        B2["POST /api/trigger/cancel"]
        B3["Inngest: backfillOrchestrator"]
        B4["Inngest: backfillEntityWorker"]
        B1 --> B3
        B3 -->|"step.invoke"| B4
    end

    subgraph console["apps/console  (port 4107)"]
        C1["Upstash WF\n/api/gateway/ingress\n2 steps"]
        C2["Inngest Pipeline\nevent.capture → eventStore\n→ entityGraph → entityEmbed\n→ notificationDispatch"]
        C3["tRPC\norg / user / m2m"]
        C4["SSE\n/api/gateway/stream\nUpstash Realtime"]
        C1 --> C2
    end

    DB[("@db/app\nNeon Postgres\n14 tables")]
    REDIS[("@vendor/upstash\nUpstash Redis\ngw:oauth:* gw:resource:*")]
    QSTASH["QStash\ntopics + direct URLs"]
    INNGEST["Inngest\ncloud orchestration"]

    R3 -->|"QStash to /api/gateway/ingress"| C1
    R3 -->|"DB write\ngatewayWebhookDeliveries"| DB
    G5 -->|"DB write\ngatewayInstallations\ngatewayResources"| DB
    G4 -->|"Redis HSET\ngw:resource:*"| REDIS
    G1 -->|"Redis HSET\ngw:oauth:state:*"| REDIS
    B4 -->|"POST /api/webhooks/:provider\nservice auth path"| RELAY
    B3 -->|"GET /services/gateway/:id\ntoken, proxy, runs"| GATEWAY
    C3 -->|"POST /services/gateway/:id/resources"| GATEWAY
    C3 -->|"POST /services/backfill/trigger"| BACKFILL
    C2 -->|"Inngest events"| INNGEST
    B3 -.->|"step.invoke"| INNGEST
```

---

## New Architecture Overview

```mermaid
flowchart TD
    EXT["External World\nGitHub · Vercel · Linear · Sentry\n(webhooks + OAuth)"]
    CLI["CLI / Browser\n(OAuth flows)"]

    EXT -->|"POST /ingest/:provider"| PLATFORM
    CLI -->|"GET /connect/:provider/authorize"| PLATFORM

    subgraph platform["apps/platform  (Hono · srvx · edge)"]
        direction TB
        P_MW["Middleware Stack\nrequestId → lifecycle → errorSanitizer → sentry"]
        P_INGEST["POST /ingest/:provider\nHMAC or X-API-Key auth"]
        P_OAUTH["GET /connect/:p/authorize\nGET /connect/:p/callback\nGET /connect/oauth/poll"]
        P_CONNECT["GET /connect/:id\nGET /token/:id\nPOST /proxy/:id\nGET /proxy/:id/endpoints"]
        P_RES["POST /connect/:id/resources\nDELETE /connect/:id/resources/:r\nDELETE /connect/:id"]
        P_RUNS["GET /connect/:id/runs\nPOST /connect/:id/runs"]
        P_ADMIN["GET /admin/dlq\nPOST /admin/dlq/replay\nPOST /admin/replay/catchup\nPOST /admin/delivery-status"]

        P_WF1["Upstash WF: ingest-delivery\n① persist-delivery\n② classify (→ connection-core)\n   lifecycle → connectionLifecycleWF\n   data → resolve + QStash\n   unknown → DLQ\n③ publish-to-console  [data only]\n④ update-status-enqueued  [data only]"]
        P_WF2["Upstash WF: connectionLifecycleWorkflow\n① cancel-backfill (Inngest event)\n② revoke-token\n③ cleanup-cache (Redis DEL gw:resource:*)\n③.5 update-ingress-gate (workspaceIntegrations.status)\n④ soft-delete (gatewayInstallations + gatewayResources)"]
        P_WF3["Upstash WF: connectionRestoreWorkflow  [new]\n① UPDATE gatewayInstallations SET status=active\n② UPDATE workspaceIntegrations SET status=active WHERE status=suspended"]

        P_INGEST --> P_WF1
        P_RES -->|"DELETE /connect/:id"| P_WF2
    end

    subgraph core["@repo/connection-core  (new package)"]
        CC1["classifier.ts\nclassifyEvent(provider, eventType, action?)\n→ lifecycle | data | unknown"]
        CC2["state-machine.ts\ntargetStatus(reason): ConnectionStatus\nvalidTransitions: Record&lt;Status, Status[]&gt;"]
        CC3["providers/\ngithub.ts · vercel.ts · linear.ts · sentry.ts\nOAuth config + event classifier + lifecycle handlers"]
        CC4["registry.ts\nPROVIDERS map (single import)"]
    end

    subgraph console["apps/console  (Next.js · port 4107)"]
        direction TB
        C_INGEST["Upstash WF: /api/ingest\n① resolve-workspace\n② CHECK workspaceIntegrations.status=active\n③ transform (connection-core provider registry)\n④ INSERT workspaceIngestLogs\n⑤ fan-out: Inngest event.capture + Realtime"]
        C_JOBS["/api/jobs  (Inngest endpoint)\nLive pipeline:\n  event.capture → eventStore\n  entity.upserted → entityGraph → entityEmbed\n  event.stored → notificationDispatch\n  activity.record → recordActivity\nBackfill pipeline (absorbed):\n  run.requested → backfillOrchestrator\n  entity.requested → backfillEntityWorker"]
        C_TRPC["tRPC\norg.connections.*\norg.workspace.*\nm2m.sources.*\nm2m.jobs.*\nuser.*"]
        C_SSE["/api/gateway/stream\n/api/gateway/realtime\nSSE + Upstash Realtime"]
        C_TRIGGER["POST /api/internal/backfill/trigger\nPOST /api/internal/backfill/cancel\n(X-API-Key auth)"]
        C_CLI["/api/cli/login\n/api/cli/setup"]

        C_INGEST -->|"inngest.send"| C_JOBS
    end

    DB[("@db/app\nNeon Postgres")]
    REDIS[("Upstash Redis\ngw:oauth:* gw:resource:*")]
    QSTASH["QStash\ntopics + direct URLs"]
    PINECONE["Pinecone\nvector DB"]
    KNOCK["Knock\nnotifications"]

    P_WF1 -->|"QStash to /api/ingest"| C_INGEST
    P_WF1 -->|"classify"| core
    P_WF2 -->|"targetStatus(reason)"| core
    C_INGEST -->|"transform"| core
    C_JOBS -->|"entityEmbed\nvector upsert"| PINECONE
    C_JOBS -->|"notificationDispatch"| KNOCK

    platform -->|"DB reads/writes"| DB
    console -->|"DB reads/writes"| DB
    platform -->|"Redis OAuth + routing cache"| REDIS
    platform -->|"QStash publish"| QSTASH
    QSTASH -->|"deliver"| C_INGEST

    C_TRPC -->|"POST /connect/:id/resources"| PLATFORM
    C_TRPC -->|"POST /api/internal/backfill/trigger"| C_TRIGGER
    C_TRIGGER -->|"inngest.send\nrun.requested"| C_JOBS
```

---

## apps/platform — Full Route and Middleware Design

### Middleware Stack (Global)

```mermaid
flowchart LR
    REQ["Incoming Request"] --> MW1

    subgraph global["Global Middleware  (app.use)"]
        MW1["requestId\nRead X-Request-Id\nGenerate nanoid() if absent\nRead X-Correlation-Id\nDefaults to requestId\nSet response headers"] --> MW2
        MW2["lifecycle\nCapture start time\nSet logFields={} on ctx\nDev: add 100-500ms delay\nOn complete: emit structured\nBetterStack log + Sentry breadcrumb\nFlush via waitUntil"] --> MW3
        MW3["errorSanitizer\nProd only: replace 5xx body\nwith generic error message"] --> MW4
        MW4["sentry\ntry/catch around next()\ncaptureException on throw\ncaptureMessage on 5xx\nTags: service, method, path,\nrequest_id, correlation_id"]
    end

    MW4 --> ROUTE["Route Handler"]
```

### Route Table

```mermaid
flowchart TD
    subgraph ingest["Webhook Ingest"]
        I1["POST /ingest/:provider\n─────────────────────────────────────\nMiddleware chain:\nproviderGuard → serviceAuthDetect\n→ serviceAuthBodyValidator (if X-API-Key)\n→ webhookHeaderGuard (if external)\n→ rawBodyCapture (if external)\n→ signatureVerify (if external)\n→ payloadParseAndExtract\n─────────────────────────────────────\nExternal path: trigger ingest-delivery WF\nService-auth path: QStash direct to /api/ingest"]
    end

    subgraph oauth["OAuth Flows"]
        O1["GET /connect/:provider/authorize\nAuth: apiKeyAuth + tenantMiddleware\nHeaders: X-Org-Id, X-User-Id\nReads: providerConfigs[provider]\nWrites: Redis gw:oauth:state:{state} TTL 600s\nReturns: {url, state}"]
        O2["GET /connect/:provider/callback\nAuth: none (state = secret)\nWrites: Redis gw:oauth:result:{state} TTL 300s\nWrites: gatewayInstallations (upsert)\nWrites: gatewayTokens (writeTokenRecord)\nRedirects: inline | redirectTo | console URL"]
        O3["GET /connect/oauth/poll\nAuth: none\nReads: Redis gw:oauth:result:{state}\nReturns: {status: pending|completed|failed}"]
    end

    subgraph connection["Connection Operations"]
        C1["GET /connect/:id\nAuth: apiKeyAuth\nReads: gatewayInstallations + tokens + resources\nReturns: id, provider, status, hasToken, resources[]"]
        C2["DELETE /connect/:id\nAuth: apiKeyAuth\nReads: gatewayInstallations\nTriggers: connectionLifecycleWorkflow\nReturns: {status: teardown_initiated}"]
        C3["GET /token/:id\nAuth: apiKeyAuth\nReads: gatewayInstallations + gatewayTokens\nDecrypts: AES-256-GCM accessToken\nRefreshes: if expiresAt in past\nReturns: {accessToken, provider, expiresIn}"]
    end

    subgraph proxy["API Proxy"]
        P1["GET /proxy/:id/endpoints\nAuth: apiKeyAuth\nReads: gatewayInstallations\nReturns: {provider, baseUrl, endpoints[]}"]
        P2["POST /proxy/:id\nAuth: apiKeyAuth\nBody: {endpointId, pathParams, queryParams, body}\nAcquires token (with 401 retry + refresh)\nProxies fetch to provider API\nReturns: {status, data, headers}"]
    end

    subgraph resources["Resource Management"]
        R1["POST /connect/:id/resources\nAuth: apiKeyAuth\nBody: {providerResourceId, resourceName?}\nWrites: gatewayResources (upsert)\nWrites: Redis gw:resource:{p}:{id} HSET\nReturns: {status: linked, resource}"]
        R2["DELETE /connect/:id/resources/:r\nAuth: apiKeyAuth\nWrites: gatewayResources SET status=removed\nDeletes: Redis gw:resource:{p}:{id}\nReturns: {status: removed}"]
    end

    subgraph runs["Backfill Run Records"]
        RU1["GET /connect/:id/runs\nAuth: apiKeyAuth\nQuery: ?status=completed\nReads: gatewayBackfillRuns\nReturns: BackfillRunReadRecord[]"]
        RU2["POST /connect/:id/runs\nAuth: apiKeyAuth\nBody: BackfillRunRecord\nWrites: gatewayBackfillRuns (upsert on installationId+resourceId+entityType)\nReturns: 200"]
    end

    subgraph admin["Admin & DLQ"]
        A1["GET /admin/health\nNo auth\nSELECT 1 probe\nReturns: {status: ok|degraded}"]
        A2["GET /admin/dlq\nAuth: apiKeyAuth\nReads: gatewayWebhookDeliveries WHERE status=dlq\nReturns: paginated delivery list"]
        A3["POST /admin/dlq/replay\nAuth: apiKeyAuth\nBody: {deliveryIds[]}\nRe-triggers ingest-delivery WF for each\nReturns: {replayed, skipped, failed}"]
        A4["POST /admin/replay/catchup\nAuth: apiKeyAuth\nBody: {installationId, batchSize, since?, until?}\nSelects status=received rows\nRe-triggers ingest-delivery WF\nReturns: {replayed, remaining}"]
        A5["POST /admin/delivery-status\nAuth: QStash signature\nQuery: ?provider=\nBody: {messageId, state, deliveryId?}\nUpdates: gatewayWebhookDeliveries.status\ndelivered|error → dlq"]
    end
```

---

## Ingest-Delivery Workflow (Platform) — Step-by-Step

Replaces relay's current `webhookDeliveryWorkflow`. Key change: step 2 now classifies events and handles lifecycle in-process.

```mermaid
sequenceDiagram
    participant EXT as External Provider
    participant PLAT as apps/platform
    participant WF as ingest-delivery WF (Upstash)
    participant CCLS as connection-core classifier
    participant DB as @db/app
    participant REDIS as Upstash Redis
    participant QSTASH as QStash
    participant CONSOLE as apps/console /api/ingest

    EXT->>PLAT: POST /ingest/:provider\n(webhook payload + HMAC headers)
    PLAT->>PLAT: providerGuard → validate provider kind=webhook
    PLAT->>PLAT: webhookHeaderGuard → validate required headers
    PLAT->>PLAT: rawBodyCapture → buffer raw body string
    PLAT->>PLAT: signatureVerify → HMAC-SHA256/SHA1 per provider
    PLAT->>PLAT: payloadParseAndExtract → parse JSON, extract deliveryId/eventType/resourceId
    PLAT->>WF: workflowClient.trigger(url=/platform/workflows/ingest-delivery, body=WebhookReceiptPayload)
    PLAT-->>EXT: 200 {status: accepted, deliveryId}

    Note over WF: Step 1: persist-delivery
    WF->>DB: INSERT gatewayWebhookDeliveries\n(provider, deliveryId, eventType, status=received)\nonConflictDoNothing → idempotent

    Note over WF: Step 2: classify
    WF->>CCLS: classifyEvent(provider, eventType, action?)
    CCLS-->>WF: "lifecycle" | "data" | "unknown"

    alt lifecycle event
        WF->>DB: SELECT gatewayInstallations\nWHERE provider=:p AND externalId=:installationId
        DB-->>WF: {id, orgId, status}
        WF->>WF: trigger connectionLifecycleWorkflow\n{reason, installationId, orgId, provider, resourceIds?}
        WF->>DB: UPDATE gatewayWebhookDeliveries\nSET status=enqueued
        WF-->>WF: return early (no QStash)
    else data event
        WF->>DB: SELECT gatewayResources r\nJOIN gatewayInstallations i ON r.installationId=i.id\nWHERE r.providerResourceId=:resourceId AND r.status=active
        DB-->>WF: {connectionId, orgId} | null
        alt connection resolved
            Note over WF: Step 3: publish-to-console
            WF->>QSTASH: publishJSON\nurl=/api/ingest\ndeduplicationId={provider}_{deliveryId}\ncallback=/admin/delivery-status?provider=\nretries=5\nbody=WebhookEnvelope
            Note over WF: Step 4: update-status-enqueued
            WF->>DB: UPDATE gatewayWebhookDeliveries SET status=enqueued
        else no connection found
            WF->>QSTASH: publishToTopic(topic=webhook-dlq, body=WebhookReceiptPayload)
            WF->>DB: UPDATE gatewayWebhookDeliveries SET status=dlq
        end
    else unknown event
        WF->>QSTASH: publishToTopic(topic=webhook-dlq)
        WF->>DB: UPDATE gatewayWebhookDeliveries SET status=dlq
    end

    QSTASH->>CONSOLE: POST /api/ingest (WebhookEnvelope, retries=5)
```

---

## connectionLifecycleWorkflow (Platform) — Step-by-Step

Replaces gateway's `connection-teardown` workflow. Key additions: step 2 classify reason uses `connection-core.state-machine`, step 3.5 updates `workspaceIntegrations.status` (the **ingress gate**), step 1 now fires an Inngest event instead of HTTP to backfill service.

```mermaid
sequenceDiagram
    participant TRIGGER as Trigger Source\n(ingest-delivery WF or DELETE /connect/:id)
    participant WF as connectionLifecycleWorkflow
    participant CORE as connection-core state-machine
    participant INNGEST as Inngest Cloud
    participant DB as @db/app
    participant REDIS as Upstash Redis
    participant PROV as Provider OAuth API

    TRIGGER->>WF: trigger({reason, installationId, orgId, provider, resourceIds?})
    Note over WF: reason = user_disconnect | provider_revoked | provider_suspended\n         | provider_repo_removed | provider_repo_deleted

    Note over WF: Step 1: cancel-backfill
    WF->>INNGEST: send event apps/run.cancelled\n{installationId, correlationId}\n(replaces HTTP POST to backfill /trigger/cancel)
    Note over WF: best-effort, errors swallowed

    Note over WF: Step 2: revoke-token
    WF->>DB: SELECT gatewayTokens WHERE installationId=:id LIMIT 1
    DB-->>WF: {id, accessToken (encrypted), refreshToken}
    alt provider has revoke endpoint (not GitHub, not suspended)
        WF->>WF: decrypt(accessToken, ENCRYPTION_KEY)
        WF->>PROV: POST /oauth/revoke or DELETE /app-install
        Note over WF: best-effort, errors swallowed
    end

    Note over WF: Step 3: cleanup-cache
    WF->>DB: SELECT gatewayResources WHERE installationId=:id AND status=active
    DB-->>WF: [{providerResourceId}, ...]
    WF->>REDIS: DEL gw:resource:{provider}:{providerResourceId} × N
    Note over WF: RELAY GATE: routing cache cleared\nany webhook arriving after this step\nwill miss Redis → DB query → miss (after step 4)

    Note over WF: Step 3.5: update-ingress-gate  [NEW vs current]
    WF->>CORE: targetStatus(reason)
    CORE-->>WF: "revoked" | "suspended" | "disconnected" | "removed" | "deleted"
    WF->>DB: UPDATE workspaceIntegrations\nSET status = targetStatus\nWHERE installationId = :installationId\n[and optionally WHERE resourceId IN :resourceIds for partial teardowns]
    Note over WF: INGRESS GATE: console /api/ingest step 2\nchecks this status before processing

    Note over WF: Step 4: soft-delete
    alt full teardown (user_disconnect | provider_revoked | provider_suspended)
        WF->>DB: db.batch([\n  UPDATE gatewayInstallations SET status=targetStatus WHERE id=:id,\n  UPDATE gatewayResources SET status=removed WHERE installationId=:id\n])
    else partial teardown (provider_repo_removed | provider_repo_deleted)
        WF->>DB: db.batch([\n  UPDATE gatewayResources SET status=targetStatus WHERE id IN :resourceIds\n])
    end
```

---

## connectionRestoreWorkflow (Platform) — New Workflow for Unsuspend

```mermaid
flowchart LR
    TRIGGER["Triggered by:\nPOST /ingest/:provider\nwhen lifecycle reason=provider_unsuspended"]
    S1["Step 1: restore-installation\nUPDATE gatewayInstallations\nSET status=active\nWHERE id=:installationId"]
    S2["Step 2: restore-integrations\nUPDATE workspaceIntegrations\nSET status=active\nWHERE installationId=:id\nAND status=suspended"]

    TRIGGER --> S1 --> S2
```

---

## OAuth Flow (Platform) — Full Sequence

```mermaid
sequenceDiagram
    participant CONSOLE_UI as Browser / CLI
    participant TRPC as console tRPC\nconnections.getAuthorizeUrl
    participant PLAT as apps/platform
    participant REDIS as Upstash Redis
    participant PROV as Provider OAuth Server
    participant PLAT_CB as apps/platform\n/connect/:p/callback
    participant DB as @db/app

    CONSOLE_UI->>TRPC: org.connections.getAuthorizeUrl(provider)
    TRPC->>PLAT: GET /connect/:provider/authorize\nHeaders: X-Org-Id, X-User-Id, X-API-Key
    PLAT->>PLAT: providerDef.auth.buildAuthUrl(config, state)\nstate = nanoid()
    PLAT->>REDIS: PIPELINE\n  HSET gw:oauth:state:{state}\n    {provider, orgId, connectedBy, createdAt}\n  EXPIRE gw:oauth:state:{state} 600
    PLAT-->>TRPC: {url, state}
    TRPC-->>CONSOLE_UI: {url, state}

    CONSOLE_UI->>PROV: Redirect to provider OAuth URL
    PROV-->>PLAT_CB: GET /connect/:provider/callback?code=&state=&...

    PLAT_CB->>REDIS: MULTI\n  HGETALL gw:oauth:state:{state}\n  DEL gw:oauth:state:{state}\nEXEC
    REDIS-->>PLAT_CB: {provider, orgId, connectedBy, ...}

    PLAT_CB->>PROV: POST /oauth/token\n(code exchange, provider-specific)
    PROV-->>PLAT_CB: {accessToken, refreshToken?, expiresIn?, externalId}

    PLAT_CB->>DB: INSERT gatewayInstallations\nON CONFLICT (provider, externalId)\nDO UPDATE SET status=active, connectedBy, orgId, providerAccountInfo

    alt provider uses stored tokens (Vercel, Linear, Sentry)
        PLAT_CB->>DB: UPSERT gatewayTokens\nSET accessToken=encrypt(token, KEY)\nSET refreshToken=encrypt(refresh, KEY)\nSET expiresAt, tokenType, scope
    end

    PLAT_CB->>REDIS: PIPELINE\n  HSET gw:oauth:result:{state}\n    {status: completed, provider, [reactivated]}\n  EXPIRE gw:oauth:result:{state} 300
    PLAT_CB-->>CONSOLE_UI: Redirect to console /?connected=true

    Note over CONSOLE_UI,REDIS: CLI polling flow
    CONSOLE_UI->>PLAT: GET /connect/oauth/poll?state={state}
    PLAT->>REDIS: HGETALL gw:oauth:result:{state}
    REDIS-->>PLAT: null | {status, provider, ...}
    PLAT-->>CONSOLE_UI: {status: pending} | {status: completed, provider}
```

---

## Service-Auth Webhook Path (Backfill → Platform → Console)

This is the path used when `backfillEntityWorker` dispatches synthetic webhooks. The `ingest-delivery` workflow is **bypassed** — the platform publishes directly to QStash.

```mermaid
sequenceDiagram
    participant WORKER as backfillEntityWorker\n(Inngest, inside apps/console)
    participant RELAY_CLIENT as createRelayClient\n(gateway-service-clients)
    participant PLAT as apps/platform
    participant QSTASH as QStash
    participant CONSOLE as apps/console /api/ingest

    WORKER->>RELAY_CLIENT: dispatchWebhook(provider, payload, holdForReplay?)
    RELAY_CLIENT->>PLAT: POST /ingest/:provider\nHeaders: X-API-Key, X-Backfill-Hold: true (if holdForReplay)\nBody: ServiceAuthWebhookBody\n  {connectionId, orgId, deliveryId, eventType, payload, receivedAt}

    PLAT->>PLAT: serviceAuthDetect → isServiceAuth=true
    PLAT->>PLAT: serviceAuthBodyValidator → parse ServiceAuthWebhookBody
    PLAT->>PLAT: payloadParseAndExtract (skips HMAC)

    alt holdForReplay=false
        PLAT->>PLAT: DB INSERT gatewayWebhookDeliveries status=received
        PLAT->>QSTASH: publishJSON\nurl=/api/ingest\nretries=5\nbody=WebhookEnvelope {deliveryId, connectionId, orgId, ...}
        PLAT->>PLAT: DB UPDATE status=enqueued
        PLAT-->>WORKER: {status: accepted, deliveryId}
        QSTASH->>CONSOLE: POST /api/ingest (WebhookEnvelope)
    else holdForReplay=true
        PLAT->>PLAT: DB INSERT gatewayWebhookDeliveries status=received
        PLAT-->>WORKER: {status: accepted, deliveryId, held: true}
        Note over PLAT: Event held in DB (status=received)\nAwaits relay.replayCatchup() from orchestrator
    end
```

---

## Console Ingress + Fan-out Pipeline (/api/ingest)

Replaces current `/api/gateway/ingress`. Key change: step 2 adds **ingress gate** check on `workspaceIntegrations.status`.

```mermaid
sequenceDiagram
    participant QSTASH as QStash
    participant INGEST as /api/ingest\n(Upstash WF, console)
    participant CORE as @repo/connection-core
    participant DB as @db/app
    participant INNGEST as Inngest Cloud
    participant REALTIME as Upstash Realtime

    QSTASH->>INGEST: POST /api/ingest\n(WebhookEnvelope: deliveryId, connectionId, orgId,\nprovider, eventType, payload, receivedAt)
    Note over INGEST: serve() auto-verifies QStash signature

    Note over INGEST: Step 1: resolve-workspace
    INGEST->>DB: SELECT orgWorkspaces WHERE clerkOrgId=:orgId LIMIT 1
    DB-->>INGEST: {id: workspaceId, clerkOrgId, name, settings} | null
    alt workspace not found
        INGEST-->>QSTASH: 200 (graceful skip — org deleted)
    end

    Note over INGEST: Step 2: check-ingress-gate  [NEW vs current]
    INGEST->>DB: SELECT workspaceIntegrations\nWHERE installationId=:connectionId\nAND workspaceId=:workspaceId
    DB-->>INGEST: {status: active|revoked|suspended|...}
    alt status !== active
        INGEST-->>QSTASH: 200 (DROP — ingress gate closed)
        Note over INGEST: Lifecycle workflow step 3.5 ran before this delivery
    end

    Note over INGEST: Step 3: transform
    INGEST->>CORE: transformWebhookPayload(provider, eventType, payload, context)
    Note over CORE: resolveCategory(eventType) → eventDef.transform(parsed, ctx)
    CORE-->>INGEST: PostTransformEvent | null
    alt unsupported event type
        INGEST-->>QSTASH: 200 (skip — no transformer)
    end

    INGEST->>INGEST: sanitizePostTransformEvent(rawEvent)

    Note over INGEST: Step 4: store-ingest-log
    INGEST->>DB: INSERT workspaceIngestLogs\n(workspaceId, deliveryId, sourceEvent, receivedAt, ingestionSource=webhook)\nRETURNING id (BIGINT cursor for SSE)
    DB-->>INGEST: {id: ingestLogId}

    Note over INGEST: Step 5: fan-out (parallel)
    par Inngest notification
        INGEST->>INNGEST: inngest.send(apps-console/event.capture, {\n  workspaceId, clerkOrgId, sourceEvent,\n  ingestLogId, ingestionSource, correlationId\n})
    and Realtime notification
        INGEST->>REALTIME: channel(org-{orgId}).emit(workspace.event, {\n  eventId: ingestLogId, workspaceId, sourceEvent\n})
    end
    INGEST-->>QSTASH: 200
```

---

## Inngest Event Pipeline (Console) — Complete Chain

```mermaid
flowchart TD
    CAPTURE["apps-console/event.capture\n{workspaceId, clerkOrgId, sourceEvent: PostTransformEvent,\n ingestLogId, ingestionSource, correlationId}"]

    subgraph eventStore["eventStore  (id: apps-console/event.store)"]
        ES1["generate-replay-safe-ids\nnanoid() + Date.now() inside step\n(deterministic on replay)"]
        ES2["resolve-clerk-org-id\nDB lookup orgWorkspaces if not in event"]
        ES3["create-job\nINSERT workspaceWorkflowRuns status=queued"]
        ES4["check-duplicate\nSELECT workspaceEvents WHERE sourceId=:id\n→ return filtered if found"]
        ES5["check-event-allowed\nResolve resourceId from attributes per provider\nSELECT workspaceIntegrations by providerResourceId\nisEventAllowed(providerConfig.sync.events, baseEventType)\n→ return filtered if not allowed"]
        ES6["evaluate-significance\nscoreSignificance(event) → 0–100\nBase: EVENT_REGISTRY[key].weight\n+ content signals ± 15\n+ ref density + body substance"]
        ES7["extract-entities\nextractEntities(title, body) → regex patterns\nextractFromRelations(relations) → structural refs\nPrepend primary entity @ confidence 1.0\nDedupe by category:key, cap at 50"]
        ES8["store-observation\nINSERT workspaceEvents\n(externalId, workspaceId, occurredAt, observationType,\ntitle, content, source, sourceType, sourceId,\nsourceReferences, metadata, significanceScore, ingestLogId)"]
        ES9["upsert-entities-and-junctions\nFOR each entity:\n  UPSERT workspaceEntities ON CONFLICT (ws, category, key)\n    SET occurrenceCount++, lastSeenAt, state, url\n  INSERT workspaceEventEntities (entityId, eventId, refLabel, category)"]
        ES10["emit-downstream-events\nif primaryEntityExternalId:\n  step.sendEvent(apps-console/entity.upserted)\nstep.sendEvent(apps-console/event.stored)"]
        ES11["complete-job-success\nUPDATE workspaceWorkflowRuns status=completed"]

        ES1 --> ES2 --> ES3 --> ES4 --> ES5 --> ES6 --> ES7 --> ES8 --> ES9 --> ES10 --> ES11
    end

    CAPTURE --> eventStore

    ES10 -->|"apps-console/entity.upserted\n{workspaceId, entityExternalId, entityType,\nprovider, internalEventId, entityRefs[]}"| GRAPH
    ES10 -->|"apps-console/event.stored\n{workspaceId, clerkOrgId, eventExternalId,\nsourceType, significanceScore}"| NOTIFY

    subgraph entityGraph["entityGraph  (id: apps-console/entity.graph)"]
        EG1["resolve-edges\nFilter entityRefs to structural types\n(commit, branch, pr, issue, deployment)\nQuery workspaceEntities by category+key\nQuery co-occurrence from workspaceEventEntities\nEvaluate cross-type pairs vs PROVIDERS[source].edgeRules\n  Priority: selfLabel+provider > selfLabel+wildcard\n          > no-label+provider > no-label+wildcard\nDedupe by canonical (lo,hi,relationship)\nUPSERT workspaceEntityEdges ON CONFLICT\n  taking GREATEST(confidence)"]
    end

    GRAPH --> entityGraph

    entityGraph -->|"apps-console/entity.graphed\n{workspaceId, entityExternalId, entityType,\nprovider, occurredAt}\n(debounced 30s per entityExternalId)"| EMBED

    subgraph entityEmbed["entityEmbed  (id: apps-console/entity.embed)"]
        EE1["fetch-entity\nSELECT workspaceEntities WHERE externalId=:id"]
        EE2["fetch-workspace\nSELECT orgWorkspaces WHERE workspaceId=:id\nvalidate settings.version===1"]
        EE3["fetch-narrative-inputs\nPARALLEL:\n  genesis event (ASC occurredAt LIMIT 1)\n  last 3 events (DESC LIMIT 3)\n  graph edges (3 outgoing UNION 3 incoming)\n  max significanceScore"]
        EE4["embed-narrative\nbuildEntityNarrative(entity, genesis, recent, edges)\n  5 sections: Identity | Genesis | Span | Recent | Related\n  cap at 1800 chars\ncomputeNarrativeHash(narrative)\nembeddingProvider.embed([narrative]) → vector"]
        EE5["upsert-entity-vector\nconsolePineconeClient.upsertVectors(\n  indexName, namespace=ws-{slug}-entities\n  id=ent_{externalId}\n  vector=embedding\n  metadata: layer, category, narrativeHash,\n            significanceScore, totalEvents, dates\n)"]

        EE1 --> EE2 --> EE3 --> EE4 --> EE5
    end

    EMBED --> entityEmbed

    subgraph notificationDispatch["notificationDispatch  (id: apps-console/notification.dispatch)"]
        ND1["Guard: skip if\n  no clerkOrgId\n  significanceScore < 70\n  Knock not configured"]
        ND2["trigger-knock-workflow\nnotifications.workflows.trigger(\n  workflow-id=observation-captured\n  recipients=[{id: clerkOrgId}]\n  tenant=clerkOrgId\n  data={eventExternalId, eventType, significanceScore, workspaceId}\n)"]

        ND1 --> ND2
    end

    NOTIFY --> notificationDispatch
```

---

## Backfill Pipeline (Absorbed into Console)

The `backfillOrchestrator` and `backfillEntityWorker` Inngest functions move from `apps/backfill/src/workflows/` to `api/console/src/inngest/workflow/backfill/`.

```mermaid
flowchart TD
    TRIGGER["POST /api/internal/backfill/trigger\n(X-API-Key auth)\nBody: BackfillTriggerPayload\n{installationId, provider, orgId, depth, entityTypes?, holdForReplay?, correlationId?}"]
    CANCEL["POST /api/internal/backfill/cancel\n(X-API-Key auth)\nBody: {installationId}\nVerifies connection exists via GET /connect/:id\nFires: apps-backfill/run.cancelled"]

    TRIGGER -->|"inngest.send(apps-backfill/run.requested)"| ORCH

    subgraph orch["backfillOrchestrator  (Inngest, inside console)"]
        O1["get-connection\nGET /connect/:installationId\nValidate status=active, orgId matches"]
        O2["get-backfill-history\nGET /connect/:id/runs?status=completed\n→ gap-aware filter: skip if prior run covers range"]
        O3["compute-since\nnow - depth*24h → ISO string\n(inside step for replay safety)"]
        O4["enumerate-work-units\nresources × resolvedEntityTypes\nFilter by gap-aware history check"]
        O5["invoke-{workUnitId}\nstep.invoke backfillEntityWorker × N\ntimeout: 4h each\nPromise.all (parallel)"]
        O6["persist-run-records\nPOST /connect/:id/runs × N\n{entityType, providerResourceId, since, depth,\nstatus: completed|failed, pagesProcessed, eventsProduced}"]
        O7["replay-held-webhooks\n(only if holdForReplay && succeeded > 0)\nloop: POST /admin/replay/catchup\n{installationId, batchSize: 200}\nuntil remaining=0, cap 500 iterations"]

        O1 --> O2 --> O3 --> O4 --> O5 --> O6 --> O7
    end

    O5 -->|"step.invoke(apps-backfill/entity.requested)"| WORKER

    subgraph worker["backfillEntityWorker  (Inngest, inside console)"]
        W1["Concurrency: 5 per orgId, 10 global\nThrottle: 4000 req/h per installationId\nCancelOn: apps-backfill/run.cancelled"]
        W2["LOOP per page (max 500 pages)\n─────────────────────────────────\nfetch-{entityType}-p{N}\nentityHandler.buildRequest(ctx, cursor)\n→ POST /proxy/:id (endpointId, pathParams, queryParams)\nentityHandler.processResponse(raw.data, ctx, cursor)\n→ {events[], nextCursor, rawCount}\n─────────────────────────────────\ndispatch-{entityType}-p{N}\nbatch 5 events:\nPOST /ingest/:provider (service-auth, X-API-Key)\n{connectionId, orgId, deliveryId, eventType, payload}\n─────────────────────────────────\nrate-limit-{entityType}-p{N}  (conditional)\nif remaining < limit*0.1:\n  step.sleep until resetAt"]

        W1 --> W2
    end

    WORKER --> worker

    subgraph serviceauth["Service-Auth Re-entry"]
        SA1["POST /ingest/:provider with X-API-Key\n→ DB INSERT + QStash to /api/ingest\n(holdForReplay: held in DB)\n→ orchestrator step replay-held-webhooks drains"]
    end

    W2 --> serviceauth
    serviceauth -->|"after drain"| CANCEL
```

---

## @repo/connection-core — Internal Design

New package extracted from `@repo/app-providers`. Currently `classifier.classify()` is on each `WebhookProvider` in `packages/console-providers/src/providers/*/index.ts`. The state machine is implicit in gateway teardown workflow step 4. This formalises both into a shared package that both `apps/platform` and `apps/console` import.

```mermaid
flowchart TD
    subgraph core["packages/connection-core/src/"]
        subgraph registry["registry.ts"]
            R1["PROVIDERS map\n{github, vercel, linear, sentry}\n(same as current @repo/app-providers PROVIDERS\nbut without backfill/API definitions)"]
            R2["getProvider(name): ProviderDefinition"]
        end

        subgraph classifier["classifier.ts"]
            C1["classifyEvent(\n  provider: SourceType,\n  eventType: string,\n  action?: string\n): EventClass"]

            C2["GitHub:\n  installation.* → lifecycle\n  installation_repositories.* → lifecycle\n  repository.deleted → lifecycle\n  pull_request, issues, push, create, delete → data\n  else → unknown"]

            C3["Vercel:\n  integration-configuration.removed → lifecycle\n  project.removed → lifecycle\n  deployment.* → data\n  else → unknown"]

            C4["Linear:\n  Issue, Comment, Project, Cycle, ProjectUpdate → data\n  (no lifecycle events via webhook)\n  else → unknown"]

            C5["Sentry:\n  installation.deleted → lifecycle\n  issue, error, comment, event_alert, metric_alert → data\n  else → unknown"]

            C1 --> C2
            C1 --> C3
            C1 --> C4
            C1 --> C5
        end

        subgraph state["state-machine.ts"]
            SM1["ConnectionStatus enum\n  active | disconnected | revoked\n  suspended | removed | deleted | error"]

            SM2["TeardownReason enum\n  user_disconnect | provider_revoked\n  provider_suspended | provider_repo_removed\n  provider_repo_deleted | provider_unsuspended"]

            SM3["targetStatus(reason): ConnectionStatus\n  user_disconnect        → disconnected\n  provider_revoked       → revoked\n  provider_suspended     → suspended\n  provider_repo_removed  → removed\n  provider_repo_deleted  → deleted\n  provider_unsuspended   → active  (restore)"]

            SM4["validTransitions: Record&lt;ConnectionStatus, ConnectionStatus[]&gt;\n  active       → [disconnected, revoked, suspended, removed, deleted, error]\n  suspended    → [active, revoked]\n  error        → [active, revoked]\n  disconnected → [active]\n  revoked      → [active]  (reinstall)\n  removed      → [active]  (re-add)\n  deleted      → []        (terminal)"]

            SM1 --> SM3
            SM2 --> SM3
            SM3 --> SM4
        end

        subgraph providers["providers/"]
            P1["github.ts\nEventClassifier (classify method)\nLifecycleEventHandlers\n  installation.deleted → provider_revoked\n  installation.suspend → provider_suspended\n  installation.unsuspend → provider_unsuspended\n  installation_repositories.removed → provider_repo_removed\n  repository.deleted → provider_repo_deleted\nOAuth config (buildAuthUrl, processCallback, getActiveToken)\nHMAC config (SHA-256, x-hub-signature-256)"]

            P2["vercel.ts\nEventClassifier\nLifecycleEventHandlers\n  integration-configuration.removed → provider_revoked\n  project.removed → provider_repo_deleted\nOAuth config\nHMAC config (SHA-1, x-vercel-signature)"]

            P3["linear.ts\nEventClassifier (data-only, no lifecycle)\nOAuth config\nHMAC config (SHA-256, linear-signature)"]

            P4["sentry.ts\nEventClassifier\nLifecycleEventHandlers\n  installation.deleted → provider_revoked\nOAuth config (composite token encoding)\nHMAC config (SHA-256, sentry-hook-signature)"]
        end

        subgraph index["index.ts"]
            I1["export:\n  classifyEvent\n  targetStatus, validTransitions, ConnectionStatus, TeardownReason\n  PROVIDERS, getProvider\n  ProviderDefinition types"]
        end
    end

    RELAY_USERS["apps/platform\n(imports for:\n  webhook classification\n  lifecycle reason extraction\n  HMAC verification\n  OAuth flows)"]

    CONSOLE_USERS["apps/console\n(imports for:\n  event transformation (dispatch.ts)\n  targetStatus (workspaceIntegrations update)\n  connection state checks)"]

    core --> RELAY_USERS
    core --> CONSOLE_USERS
```

---

## Database Schema — Table Ownership by Service

```mermaid
erDiagram
    gatewayInstallations {
        varchar id PK
        varchar provider
        varchar external_id
        varchar connected_by
        varchar org_id
        varchar status "active|pending|error|revoked|suspended"
        jsonb provider_account_info
        jsonb backfill_config
        timestamp created_at
        timestamp updated_at
    }

    gatewayTokens {
        varchar id PK
        varchar installation_id FK
        text access_token "AES-256-GCM encrypted"
        text refresh_token "AES-256-GCM encrypted"
        timestamp expires_at
        varchar token_type
        text scope
    }

    gatewayResources {
        varchar id PK
        varchar installation_id FK
        varchar provider_resource_id
        varchar resource_name
        varchar status "active|removed"
    }

    gatewayWebhookDeliveries {
        varchar id PK
        varchar provider
        varchar delivery_id
        varchar event_type
        varchar installation_id "no FK, populated post-resolution"
        varchar status "received|enqueued|delivered|dlq"
        text payload "stored for replay"
        timestamp received_at
    }

    gatewayBackfillRuns {
        varchar id PK
        varchar installation_id FK
        varchar provider_resource_id
        varchar entity_type
        timestamp since
        int depth
        varchar status "idle|pending|running|completed|failed|cancelled"
        int pages_processed
        int events_produced
        int events_dispatched
        text error
    }

    workspaceIntegrations {
        varchar id PK
        varchar workspace_id FK
        varchar installation_id FK
        varchar provider
        jsonb provider_config "sync.events, providerType"
        varchar provider_resource_id
        boolean is_active "→ migrate to status column (Phase 4)"
        varchar last_sync_status "success|failed|pending"
    }

    orgWorkspaces {
        varchar id PK
        varchar clerk_org_id
        varchar name
        varchar slug
        jsonb settings "embedding config, workspace settings v1"
    }

    workspaceIngestLogs {
        bigint id PK "monotonic SSE cursor"
        varchar workspace_id FK
        varchar delivery_id
        jsonb source_event "PostTransformEvent"
        varchar ingestion_source "webhook|backfill"
        timestamp received_at
    }

    workspaceEvents {
        bigint id PK
        varchar external_id UK
        varchar workspace_id FK
        timestamp occurred_at
        varchar observation_type
        varchar title
        text content
        varchar source
        varchar source_id
        jsonb source_references "EntityRelation[]"
        jsonb metadata
        int significance_score
        bigint ingest_log_id FK
    }

    workspaceEntities {
        bigint id PK
        varchar external_id UK
        varchar workspace_id FK
        varchar category "commit|branch|pr|issue|deployment|engineer|project|..."
        varchar key
        int occurrence_count
        real confidence
        varchar state
        timestamp last_seen_at
    }

    workspaceEntityEdges {
        bigint id PK
        varchar workspace_id FK
        bigint source_entity_id FK
        bigint target_entity_id FK
        varchar relationship_type
        real confidence
        bigint source_event_id FK
    }

    workspaceEventEntities {
        bigint id PK
        bigint entity_id FK
        bigint event_id FK
        varchar workspace_id FK
        varchar ref_label
        varchar category "denormalized"
    }

    workspaceWorkflowRuns {
        bigint id PK
        varchar clerk_org_id
        varchar workspace_id FK
        varchar inngest_run_id
        varchar inngest_function_id
        varchar status "queued|running|completed|failed|cancelled"
        varchar trigger "manual|scheduled|webhook|automatic"
        jsonb input
        jsonb output
    }

    orgApiKeys {
        bigint id PK
        varchar clerk_org_id
        varchar key_hash "SHA-256"
        varchar key_prefix
        varchar key_suffix
        boolean is_active
        timestamp expires_at
    }

    gatewayInstallations ||--o{ gatewayTokens : "has one token"
    gatewayInstallations ||--o{ gatewayResources : "has many resources"
    gatewayInstallations ||--o{ gatewayBackfillRuns : "has many runs"
    gatewayInstallations ||--o{ workspaceIntegrations : "has many integrations"
    workspaceIntegrations }o--|| orgWorkspaces : "belongs to workspace"
    workspaceEvents }o--|| orgWorkspaces : "belongs to workspace"
    workspaceEvents ||--o{ workspaceEventEntities : "has many entity junctions"
    workspaceEntities }o--|| orgWorkspaces : "belongs to workspace"
    workspaceEntities ||--o{ workspaceEventEntities : "has many event junctions"
    workspaceEntities ||--o{ workspaceEntityEdges : "has many edges"
    workspaceEvents |o--o| workspaceIngestLogs : "linked via ingestLogId"
```

---

## Redis Key Ownership

```mermaid
flowchart LR
    subgraph keys["Upstash Redis Keys (gw: namespace)"]
        K1["gw:oauth:state:{token}\nType: Hash\nTTL: 600s\nFields: provider, orgId, connectedBy, redirectTo, createdAt\nSET: platform GET /connect/:p/authorize\nDEL: platform GET /connect/:p/callback (atomic consume)"]

        K2["gw:oauth:result:{state}\nType: Hash\nTTL: 300s\nFields: status, provider, [reactivated|setupAction|error]\nSET: platform GET /connect/:p/callback (on complete/fail)\nGET: platform GET /connect/oauth/poll"]

        K3["gw:resource:{provider}:{resourceId}\nType: Hash\nTTL: none (permanent until DEL)\nFields: connectionId, orgId\nSET: platform POST /connect/:id/resources (registerResource)\nDEL: platform DELETE /connect/:id/resources/:r (single)\nDEL: platform connectionLifecycleWorkflow step 3 (bulk)\nNOTE: NOT READ during webhook routing\n(relay resolves via DB join, not Redis)"]
    end

    PLATFORM["apps/platform"] --> K1
    PLATFORM --> K2
    PLATFORM --> K3
```

---

## tRPC → Platform HTTP Call Map

Which tRPC procedures in apps/console call apps/platform (formerly relay + gateway):

```mermaid
flowchart TD
    subgraph calls_platform["tRPC Procedures that call apps/platform"]
        T1["org.connections.getAuthorizeUrl\n→ GET /connect/:provider/authorize\n  Headers: X-Org-Id, X-User-Id, X-API-Key\n  Returns: {url, state}"]
        T2["org.connections.cliAuthorize\n→ GET /connect/:provider/authorize?redirect_to=inline\n  Returns: {url, state}"]
        T3["org.connections.github.validate\n→ POST /proxy/:installationId\n  {endpointId: get-app-installation}"]
        T4["org.connections.github.detectConfig\n→ POST /proxy/:installationId\n  {endpointId: get-repo} (1x)\n  {endpointId: get-file-contents} (up to 4x)"]
        T5["org.connections.generic.listInstallations\n→ POST /proxy/:installationId\n  provider.resourcePicker.enrichInstallation() per install"]
        T6["org.connections.generic.listResources\n→ POST /proxy/:installationId\n  provider.resourcePicker.listResources()"]
        T7["org.workspace.integrations.linkVercelProject\n→ POST /connect/:id/resources (best-effort)\n→ POST /api/internal/backfill/trigger (best-effort, console-internal)"]
        T8["org.workspace.integrations.bulkLinkResources\n→ POST /connect/:id/resources × per-resource (best-effort)\n→ POST /api/internal/backfill/trigger × 1-2 (best-effort, console-internal)"]
        T9["org.workspace.create\n→ POST /api/internal/backfill/trigger × per-active-install (best-effort, console-internal)"]
    end

    subgraph db_only["tRPC Procedures that are DB-only (no platform calls)"]
        D1["org.connections.list\norg.connections.disconnect\norg.connections.updateBackfillConfig\norg.connections.vercel.disconnect"]
        D2["org.workspace.listByClerkOrgSlug\norg.workspace.getByName\norg.workspace.updateName\norg.workspace.sources.list\norg.workspace.store.get\norg.workspace.integrations.disconnect\norg.workspace.integrations.unlinkVercelProject\norg.workspace.integrations.updateEvents\norg.workspace.events.list"]
        D3["m2m.sources.findByGithubRepoId\nm2m.sources.getSourceIdByGithubRepoId\nm2m.sources.markGithubRepoInactive\nm2m.sources.markGithubInstallationInactive\nm2m.sources.markGithubDeleted\nm2m.sources.updateGithubMetadata"]
        D4["m2m.jobs.create\nm2m.jobs.updateStatus\nm2m.jobs.complete\nm2m.jobs.get"]
    end

    note1["NOTE: In new model\nnotifyBackfill() no longer calls\n/services/backfill/trigger (external HTTP)\nInstead: POST /api/internal/backfill/trigger\n(console-internal, same process)"]
```

---

## Phase Migration Map

```mermaid
flowchart TD
    subgraph phase1["Phase 1: Absorb backfill into console  (LOW RISK)"]
        P1A["Move apps/backfill/src/workflows/backfill-orchestrator.ts\n→ api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts"]
        P1B["Move apps/backfill/src/workflows/entity-worker.ts\n→ api/console/src/inngest/workflow/backfill/entity-worker.ts"]
        P1C["Add POST /api/internal/backfill/trigger (X-API-Key auth)\nAdd POST /api/internal/backfill/cancel (X-API-Key auth)\n(or tRPC mutations)"]
        P1D["Update notifyBackfill() to call /api/internal/backfill/trigger\n(instead of createBackfillClient().trigger())"]
        P1E["Update connectionLifecycleWorkflow step 1\nto fire Inngest event instead of QStash to /trigger/cancel"]
        P1F["Delete apps/backfill"]
    end

    subgraph phase2["Phase 2: Merge relay + gateway into platform  (MEDIUM RISK)"]
        P2A["Create apps/platform with unified Hono app"]
        P2B["Move relay routes:\n  POST /api/webhooks/:p → POST /ingest/:p\n  POST /api/workflows/webhook-delivery → POST /platform/workflows/ingest-delivery\n  GET|POST /api/admin/* → GET|POST /admin/*"]
        P2C["Move gateway routes:\n  /services/gateway/:p/authorize → /connect/:p/authorize\n  /services/gateway/:p/callback → /connect/:p/callback\n  /services/gateway/oauth/status → /connect/oauth/poll\n  /services/gateway/:id → /connect/:id\n  /services/gateway/:id/token → /token/:id\n  /services/gateway/:id/proxy/* → /proxy/:id\n  DELETE /services/gateway/:p/:id → DELETE /connect/:id\n  /services/gateway/:id/resources → /connect/:id/resources\n  /services/gateway/:id/backfill-runs → /connect/:id/runs"]
        P2D["Add lifecycle classify step to ingest-delivery WF\n(inline lifecycle handling = race condition fix)"]
        P2E["Add connectionRestoreWorkflow for unsuspend events"]
        P2F["Update gateway-service-clients URLs:\n  gatewayUrl: /services/gateway → /connect\n  relayUrl: /services/relay → /ingest\n  backfillUrl: removed (now console-internal)"]
        P2G["Delete apps/relay + apps/gateway"]
    end

    subgraph phase3["Phase 3: Extract @repo/connection-core  (LOW RISK)"]
        P3A["Create packages/connection-core\nExtract from @repo/app-providers:\n  classifier per-provider (is lifecycle/data/unknown)\n  state-machine (targetStatus, validTransitions)\n  provider OAuth configs\n  HMAC configs per provider"]
        P3B["Update apps/platform + apps/console imports\nto use @repo/connection-core instead of\nper-provider files in @repo/app-providers"]
    end

    subgraph phase4["Phase 4: workspaceIntegrations.status migration  (MEDIUM RISK)"]
        P4A["DB migration:\nADD COLUMN status varchar(50)\nBACKFILL: status = isActive ? 'active' : 'disconnected'\nADD INDEX on status"]
        P4B["Update connectionLifecycleWorkflow step 3.5\nto write status (not just isActive=false)"]
        P4C["Update /api/ingest step 2\nto CHECK status=active (not isActive=true)"]
        P4D["Update all m2m.sources.* procedures\nto write status (not isActive)\nmarkGithubInstallationInactive → status=revoked\nmarkGithubRepoInactive → status=removed"]
        P4E["DROP COLUMN is_active after cutover verification"]
    end

    phase1 --> phase2 --> phase3 --> phase4
```

---

## Code References

### Current Codebase (maps to new design)

| Current Location | Maps to New Design |
|---|---|
| `apps/relay/src/routes/webhooks.ts:44` | `apps/platform/src/routes/ingest.ts` |
| `apps/relay/src/routes/workflows.ts:38` | `apps/platform/src/workflows/ingest-delivery.ts` |
| `apps/relay/src/middleware/webhook.ts` | `apps/platform/src/middleware/webhook.ts` (unchanged) |
| `apps/relay/src/routes/admin.ts` | `apps/platform/src/routes/admin.ts` |
| `apps/gateway/src/routes/connections.ts` | `apps/platform/src/routes/connect.ts` |
| `apps/gateway/src/workflows/connection-teardown.ts` | `apps/platform/src/workflows/connection-lifecycle.ts` |
| `apps/gateway/src/lib/token-store.ts` | `apps/platform/src/lib/token-store.ts` |
| `apps/gateway/src/lib/cache.ts` | `apps/platform/src/lib/cache.ts` |
| `apps/backfill/src/workflows/backfill-orchestrator.ts` | `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts` |
| `apps/backfill/src/workflows/entity-worker.ts` | `api/console/src/inngest/workflow/backfill/entity-worker.ts` |
| `apps/backfill/src/routes/trigger.ts` | `apps/console/src/app/api/internal/backfill/trigger/route.ts` |
| `apps/console/src/app/api/gateway/ingress/route.ts` | `apps/console/src/app/api/ingest/route.ts` |
| `packages/console-providers/src/providers/*/index.ts` (classifier) | `packages/connection-core/src/providers/*.ts` |
| `packages/console-providers/src/registry.ts` (PROVIDERS) | `packages/connection-core/src/registry.ts` (subset) |
| Implicit state transitions in gateway teardown workflow | `packages/connection-core/src/state-machine.ts` |

### Key File Paths (Current)

- `apps/relay/src/app.ts` — Hono app + middleware registration
- `apps/relay/src/routes/workflows.ts:38-225` — 5-step webhook delivery workflow
- `apps/gateway/src/routes/connections.ts:47-1210` — all OAuth + connection routes
- `apps/gateway/src/workflows/connection-teardown.ts:39-152` — 4-step teardown workflow
- `apps/backfill/src/workflows/backfill-orchestrator.ts:12-333`
- `apps/backfill/src/workflows/entity-worker.ts:13-265`
- `apps/console/src/app/api/gateway/ingress/route.ts:29-136` — current 2-step ingress
- `api/console/src/inngest/workflow/neural/event-store.ts:109-584` — main Inngest pipeline
- `packages/console-providers/src/gateway.ts` — all cross-service wire types
- `packages/console-providers/src/providers/github/index.ts:258-276` — GitHub classifier
- `packages/console-providers/src/providers/vercel/index.ts:283-296` — Vercel classifier
- `packages/gateway-service-clients/src/headers.ts:22-34` — service auth headers
- `db/console/src/schema/tables/` — all 14 table definitions

---

## Historical Context

- `thoughts/shared/research/2026-03-17-infrastructure-redesign.md` — the original redesign plan with race condition analysis and 4-phase migration path
- `thoughts/shared/plans/2026-03-17-lifecycle-v1-polling-passive.md` — lifecycle handling V1 plan
- `thoughts/shared/plans/2026-03-17-provider-architecture-extensibility.md` — provider extensibility plan

---

## Open Questions

1. **workspaceIntegrations.status Phase 4**: The current DB column is `isActive: boolean`. The new design needs a `status` column with 7 values. The migration backfill strategy (active/disconnected mapping) needs validation against existing data.

2. **Inngest cancelOn for backfill**: When `backfillOrchestrator` moves into console, it will fire `apps-backfill/run.cancelled` as an Inngest event (step 1 of connectionLifecycleWorkflow). But that event currently is the backfill Inngest client's event schema — needs to unify into the console Inngest client.

3. **Redis routing cache read path**: `gw:resource:*` is written by `POST /connect/:id/resources` but never read by the current relay (which uses DB joins). If the design intends to use it for routing, step 2 of ingest-delivery should be updated to Redis-first with DB fallback. If not, the resource key writes can be removed.

4. **console URL for QStash**: Currently `consoleUrl/api/gateway/ingress`. In new design: `consoleUrl/api/ingest`. All QStash `publishJSON` calls in platform need to be updated.

5. **gateway-service-clients base URLs**: Currently `{consoleBase}/services/gateway` and `{consoleBase}/services/relay`. In new design: `{consoleBase}/connect` and `{consoleBase}/ingest`. The `backfillUrl` entry is removed (calls become console-internal).
