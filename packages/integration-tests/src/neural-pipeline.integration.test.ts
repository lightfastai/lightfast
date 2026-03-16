/**
 * Neural Pipeline Integration Tests
 *
 * Covers the eventStore → entityGraph → entityEmbed Inngest function chain.
 *
 * Infrastructure: PGlite for DB state, in-memory mocks for Pinecone and embedding,
 * handler-capture pattern (same as backfill/relay tests).
 *
 * Key design:
 * - @console/inngest-client alias is mocked → createFunction registrations captured
 * - step.sendEvent.mock.calls used to chain functions (not inngest.send)
 * - Real NonRetriableError from "inngest" used for error assertions
 */

import {
  gatewayInstallations,
  orgWorkspaces,
  workspaceEntities,
  workspaceEventEntities,
  workspaceEvents,
  workspaceIntegrations,
  workspaceWorkflowRuns,
} from "@db/console/schema";
import type { PostTransformEvent } from "@repo/console-providers";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { makeStep } from "./harness.js";

// ── Step 1: vi.hoisted — allocate shared state ──
// These must be created before any mock factories run.

const { capturedHandlers, pineconeUpserts } = vi.hoisted(() => ({
  capturedHandlers: new Map<
    string,
    (args: { event: unknown; step: unknown }) => Promise<unknown>
  >(),
  pineconeUpserts: [] as unknown[],
}));

const { createEmbeddingProviderForWorkspace, embedMock } = vi.hoisted(() => {
  const embedMock = vi.fn().mockResolvedValue({
    embeddings: [new Array(1024).fill(0.1)],
    model: "test-model",
  });
  const createEmbeddingProviderForWorkspace = vi
    .fn()
    .mockReturnValue({ embed: embedMock, dimension: 1024 });
  return { createEmbeddingProviderForWorkspace, embedMock };
});

// ── Step 2: vi.mock declarations (hoisted before imports) ──

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

// Mock the inngest singleton — intercepted by neural functions via relative
// import "../../client/client" which resolves to the same file as @console/inngest-client.
vi.mock("@console/inngest-client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      handler: (args: { event: unknown; step: unknown }) => Promise<unknown>
    ) => {
      capturedHandlers.set(config.id, handler);
      return { id: config.id };
    },
    send: vi.fn(),
  },
}));

vi.mock("@vendor/inngest", () => ({
  Inngest: class {
    createFunction = (
      config: { id: string },
      _trigger: unknown,
      handler: (args: { event: unknown; step: unknown }) => Promise<unknown>
    ) => {
      capturedHandlers.set(config.id, handler);
      return { id: config.id };
    };
    send = vi.fn();
  },
  EventSchemas: class {
    fromSchema() {
      return this;
    }
  },
  NonRetriableError: class extends Error {
    name = "NonRetriableError" as const;
  },
  RetryAfterError: class extends Error {
    name = "RetryAfterError" as const;
  },
  InngestMiddleware: class {},
}));

vi.mock("@vendor/inngest/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

vi.mock("@repo/console-pinecone", () => ({
  consolePineconeClient: {
    upsertVectors: vi.fn(async (...args: unknown[]) => {
      pineconeUpserts.push(args);
    }),
  },
}));

vi.mock("@repo/console-embed", () => ({
  createEmbeddingProviderForWorkspace,
}));

vi.mock("@vendor/knock", () => ({
  notifications: null,
  Knock: class {},
}));

// ── Step 3: DB singleton (must be declared before mocks reference it) ──
let db: TestDb;

// ── Step 4: Import neural modules (triggers createFunction registrations) ──
// Placed in beforeAll to ensure mocks are installed first.

beforeAll(async () => {
  db = await createTestDb();
  // This import triggers eventStore, entityGraph, entityEmbed createFunction registrations.
  await import("@console/neural");
});

beforeEach(async () => {
  pineconeUpserts.length = 0;
  await resetTestDb();
  vi.clearAllMocks();
  // Re-install mocks cleared by clearAllMocks
  embedMock.mockResolvedValue({
    embeddings: [new Array(1024).fill(0.1)],
    model: "test-model",
  });
  createEmbeddingProviderForWorkspace.mockReturnValue({
    embed: embedMock,
    dimension: 1024,
  });
  const pineconeModule = await import("@repo/console-pinecone");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(
    (pineconeModule as any).consolePineconeClient.upsertVectors
  ).mockImplementation(async (...args: unknown[]) => {
    pineconeUpserts.push(args);
  });
  await seedNeuralFixtures(db);
});

afterAll(async () => {
  await closeTestDb();
});

// ── Fixture helpers ──

const BASE_EVENT: PostTransformEvent = {
  deliveryId: "del_test001",
  sourceId: "github:pr:org/repo#100:merged",
  provider: "github",
  eventType: "pull_request.merged",
  occurredAt: "2026-03-14T10:00:00.000Z",
  entity: {
    provider: "github",
    entityType: "pr",
    entityId: "org/repo#100",
    title: "feat: add neural pipeline",
    url: "https://github.com/org/repo/pull/100",
    state: "merged",
  },
  relations: [
    {
      provider: "github",
      entityType: "repository",
      entityId: "org/repo",
      title: null,
      url: null,
      relationshipType: "belongs_to",
    },
    {
      provider: "github",
      entityType: "commit",
      entityId: "abc123def456",
      title: null,
      url: null,
      relationshipType: "merged_via",
    },
  ],
  title: "feat: add neural pipeline",
  body: "Implements the neural pipeline for entity embedding.",
  attributes: { repoId: 567_890_123 },
};

async function seedNeuralFixtures(testDb: TestDb) {
  await testDb.insert(gatewayInstallations).values({
    id: "inst_test001",
    provider: "github",
    externalId: "gh_install_123",
    connectedBy: "user_test001",
    orgId: "org_test001",
    status: "active",
  });

  await testDb.insert(orgWorkspaces).values({
    id: "ws_test001",
    clerkOrgId: "org_test001",
    name: "test-workspace",
    slug: "test-ws",
    settings: {
      version: 1,
      embedding: {
        indexName: "lightfast-v1",
        namespaceName: "org_test001:ws_ws_test001",
        embeddingDim: 1024,
        embeddingModel: "embed-english-v3.0",
        embeddingProvider: "cohere",
        pineconeMetric: "cosine",
        pineconeCloud: "aws",
        pineconeRegion: "us-east-1",
        chunkMaxTokens: 512,
        chunkOverlap: 50,
      },
    },
  });

  await testDb.insert(workspaceIntegrations).values({
    workspaceId: "ws_test001",
    installationId: "inst_test001",
    provider: "github",
    providerResourceId: "567890123",
    providerConfig: {
      provider: "github",
      type: "repository",
      sync: { autoSync: true },
    },
  });
}

/** Make an event.capture Inngest event envelope */
function makeCaptureEvent(sourceEvent: PostTransformEvent) {
  return {
    id: `test-run-${Date.now()}`,
    data: {
      workspaceId: "ws_test001",
      clerkOrgId: "org_test001",
      sourceEvent,
    },
  };
}

/** Extract a named sendEvent call from a step mock */
function extractSendEvent(
  step: ReturnType<typeof makeStep>,
  eventName: string
): { name: string; data: Record<string, unknown> } | undefined {
  const calls = (step.sendEvent as ReturnType<typeof vi.fn>).mock.calls as [
    string,
    { name: string; data: Record<string, unknown> },
  ][];
  return calls.map(([, evt]) => evt).find((evt) => evt.name === eventName);
}

// ── Handler accessors ──

function getEventStoreHandler() {
  const h = capturedHandlers.get("apps-console/event.store");
  if (!h) {
    throw new Error("eventStore handler not registered");
  }
  return h as (args: {
    event: {
      id?: string;
      data: {
        workspaceId: string;
        clerkOrgId?: string;
        sourceEvent: PostTransformEvent;
      };
    };
    step: ReturnType<typeof makeStep>;
  }) => Promise<{ status: string; reason?: string }>;
}

function getEntityGraphHandler() {
  const h = capturedHandlers.get("apps-console/entity.graph");
  if (!h) {
    throw new Error("entityGraph handler not registered");
  }
  return h as (args: {
    event: { data: Record<string, unknown> };
    step: ReturnType<typeof makeStep>;
  }) => Promise<{ edgeCount: number }>;
}

function getEntityEmbedHandler() {
  const h = capturedHandlers.get("apps-console/entity.embed");
  if (!h) {
    throw new Error("entityEmbed handler not registered");
  }
  return h as (args: {
    event: { data: Record<string, unknown> };
    step: ReturnType<typeof makeStep>;
  }) => Promise<unknown>;
}

// ── PGlite raw client helper for Suite 3 ──

interface PgLiteClient {
  exec: (sql: string) => Promise<unknown>;
}

function getRawClient(testDb: TestDb) {
  return (testDb as unknown as { $client: PgLiteClient }).$client;
}

// ── Test suites ──

describe("Suite 1 — eventStore happy path", () => {
  it("stores event, entities, junctions and emits downstream events", async () => {
    const step = makeStep();
    const result = await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step,
    });

    expect(result.status).toBe("stored");

    // Job record created and completed
    const jobs = await db.select().from(workspaceWorkflowRuns);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("completed");

    // Event row stored
    const events = await db.select().from(workspaceEvents);
    expect(events).toHaveLength(1);
    expect(events[0]?.sourceId).toBe(BASE_EVENT.sourceId);

    // Primary entity stored
    const entities = await db.select().from(workspaceEntities);
    expect(entities.length).toBeGreaterThanOrEqual(1);
    const primary = entities.find(
      (e) =>
        e.category === BASE_EVENT.entity.entityType &&
        e.key === BASE_EVENT.entity.entityId
    );
    expect(primary).toBeDefined();

    // Junction rows created
    const junctions = await db.select().from(workspaceEventEntities);
    expect(junctions.length).toBeGreaterThanOrEqual(1);

    // Downstream events emitted via step.sendEvent
    const upsertedEvt = extractSendEvent(step, "apps-console/entity.upserted");
    expect(upsertedEvt).toBeDefined();
    const storedEvt = extractSendEvent(step, "apps-console/event.stored");
    expect(storedEvt).toBeDefined();
  });
});

describe("Suite 2 — eventStore duplicate event (idempotency)", () => {
  it("second call returns duplicate status and produces only 1 event row", async () => {
    const step1 = makeStep();
    const result1 = await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step: step1,
    });
    expect(result1.status).toBe("stored");

    const step2 = makeStep();
    const result2 = await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step: step2,
    });
    expect(result2.status).toBe("duplicate");

    // Only 1 event row in DB
    const events = await db.select().from(workspaceEvents);
    expect(events).toHaveLength(1);
  });
});

describe("Suite 3 — eventStore disallowed event type", () => {
  it("returns filtered when event type not in allowlist", async () => {
    // Update integration to only allow "issues" event type, excluding pull_request
    const client = getRawClient(db);
    const config = JSON.stringify({
      version: 1,
      sourceType: "github",
      type: "repository",
      repoId: "567890123",
      sync: { autoSync: false, events: ["issues"] },
    });
    await client.exec(
      `UPDATE lightfast_workspace_integrations SET provider_config = '${config}'::jsonb WHERE workspace_id = 'ws_test001'`
    );

    const step = makeStep();
    const result = await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step,
    });

    expect(result.status).toBe("filtered");
    expect(result.reason).toContain("Event type not enabled");

    // No event row stored
    const events = await db.select().from(workspaceEvents);
    expect(events).toHaveLength(0);
  });
});

describe("Suite 4 — eventStore → entityGraph chain", () => {
  it("entityGraph resolves edges and emits entity.graphed", async () => {
    // Step 1: Run eventStore
    const step1 = makeStep();
    const storeResult = await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step: step1,
    });
    expect(storeResult.status).toBe("stored");

    // Step 2: Extract entity.upserted event
    const upsertedEvt = extractSendEvent(step1, "apps-console/entity.upserted");
    expect(upsertedEvt).toBeDefined();

    // Step 3: Run entityGraph
    const step2 = makeStep();
    const graphResult = await getEntityGraphHandler()({
      event: { data: upsertedEvt!.data },
      step: step2,
    });

    // edgeCount is 0 for first event (no prior co-occurrences)
    expect(typeof graphResult.edgeCount).toBe("number");

    // entity.graphed emitted
    const graphedEvt = extractSendEvent(step2, "apps-console/entity.graphed");
    expect(graphedEvt).toBeDefined();
    expect(graphedEvt!.data.entityExternalId).toBe(
      upsertedEvt!.data.entityExternalId
    );
  });
});

describe("Suite 5 — eventStore → entityGraph → entityEmbed full chain", () => {
  it("embeds narrative and upserts to Pinecone with correct metadata", async () => {
    // Step 1: eventStore
    const step1 = makeStep();
    await getEventStoreHandler()({
      event: makeCaptureEvent(BASE_EVENT),
      step: step1,
    });
    const upsertedEvt = extractSendEvent(step1, "apps-console/entity.upserted");
    expect(upsertedEvt).toBeDefined();

    // Step 2: entityGraph
    const step2 = makeStep();
    await getEntityGraphHandler()({
      event: { data: upsertedEvt!.data },
      step: step2,
    });
    const graphedEvt = extractSendEvent(step2, "apps-console/entity.graphed");
    expect(graphedEvt).toBeDefined();

    // Step 3: entityEmbed
    const step3 = makeStep();
    await getEntityEmbedHandler()({
      event: { data: graphedEvt!.data },
      step: step3,
    });

    // Pinecone upsert called once
    expect(pineconeUpserts).toHaveLength(1);
    const [indexName, upsertArgs] = pineconeUpserts[0] as [
      string,
      {
        ids: string[];
        vectors: number[][];
        metadata: Record<string, unknown>[];
      },
      string,
    ];

    // Index name from workspace settings
    expect(indexName).toBe("lightfast-v1");

    // Vector ID format: ent_<entityExternalId>
    const entityExternalId = upsertedEvt!.data.entityExternalId as string;
    expect(upsertArgs.ids[0]).toBe(`ent_${entityExternalId}`);

    // Metadata shape
    expect(upsertArgs.metadata[0]?.layer).toBe("entities");
    expect(upsertArgs.metadata[0]?.provider).toBe("github");

    // Embed called once
    expect(embedMock).toHaveBeenCalledTimes(1);
  });
});

describe("Suite 6 — entityEmbed NonRetriableError on missing entity", () => {
  it("throws when entity does not exist in DB", async () => {
    const step = makeStep();
    const fakeGraphedData = {
      workspaceId: "ws_test001",
      entityExternalId: "nonexistent_entity_id",
      entityType: "pr",
      provider: "github",
      occurredAt: "2026-03-14T10:00:00.000Z",
    };

    await expect(
      getEntityEmbedHandler()({
        event: { data: fakeGraphedData },
        step,
      })
    ).rejects.toThrow("nonexistent_entity_id");

    // No Pinecone upserts
    expect(pineconeUpserts).toHaveLength(0);
  });
});

describe("Suite 7 — eventStore missing repoId attribute (no resourceId → filtered)", () => {
  it("returns filtered when attributes has no repoId", async () => {
    const eventWithNoRepoId: PostTransformEvent = {
      ...BASE_EVENT,
      sourceId: "github:pr:org/repo#101:opened",
      attributes: {}, // no repoId
    };

    const step = makeStep();
    const result = await getEventStoreHandler()({
      event: makeCaptureEvent(eventWithNoRepoId),
      step,
    });

    expect(result.status).toBe("filtered");

    // No event row stored
    const events = await db.select().from(workspaceEvents);
    expect(events).toHaveLength(0);
  });
});
