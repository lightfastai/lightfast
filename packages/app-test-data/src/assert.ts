import { db } from "@db/app/client";
import { gatewayWebhookDeliveries, orgIngestLogs } from "@db/app/schema";
import type { ProviderSlug } from "@repo/app-providers";
import { and, eq } from "drizzle-orm";
import {
  DEFAULT_ASSERTION_TIMEOUT_MS,
  DEFAULT_POLL_INTERVAL_MS,
} from "./config";
import type {
  AssertionOptions,
  AssertionResult,
  LocalE2EScenario,
  ReplayResult,
} from "./types";

interface AssertionTimeoutErrorFields {
  deliveryId: string;
  elapsedMs: number;
  lastIngestLogs: number;
  lastStatus: string | null;
  provider: ProviderSlug;
  scenario: string;
  url: string;
}

class AssertionTimeoutError extends Error {
  readonly deliveryId: string;
  readonly elapsedMs: number;
  readonly lastIngestLogs: number;
  readonly lastStatus: string | null;
  readonly provider: ProviderSlug;
  readonly scenario: string;
  readonly url: string;

  constructor(message: string, fields: AssertionTimeoutErrorFields) {
    super(message);
    this.name = "AssertionTimeoutError";
    this.deliveryId = fields.deliveryId;
    this.elapsedMs = fields.elapsedMs;
    this.lastIngestLogs = fields.lastIngestLogs;
    this.lastStatus = fields.lastStatus;
    this.provider = fields.provider;
    this.scenario = fields.scenario;
    this.url = fields.url;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertReplayResult(
  scenario: LocalE2EScenario,
  replayResult: ReplayResult,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_ASSERTION_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const step = scenario.replays.find(
    (candidate) => candidate.fixture === replayResult.fixtureRef
  );

  if (!step) {
    throw new Error(
      `Unable to resolve replay step for fixture "${replayResult.fixtureRef}"`
    );
  }

  const startedAt = Date.now();
  let lastStatus: string | null = null;
  let lastIngestLogs = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const [delivery] = await db
      .select({
        status: gatewayWebhookDeliveries.status,
      })
      .from(gatewayWebhookDeliveries)
      .where(
        and(
          eq(gatewayWebhookDeliveries.provider, replayResult.provider),
          eq(gatewayWebhookDeliveries.deliveryId, replayResult.deliveryId)
        )
      )
      .limit(1);

    const ingestLogs = await db
      .select({ id: orgIngestLogs.id })
      .from(orgIngestLogs)
      .where(
        and(
          eq(orgIngestLogs.clerkOrgId, scenario.clerkOrgId),
          eq(orgIngestLogs.deliveryId, replayResult.deliveryId)
        )
      );

    lastStatus = delivery?.status ?? null;
    lastIngestLogs = ingestLogs.length;

    const deliveryOk = step.expectedDeliveryStatus
      ? lastStatus === step.expectedDeliveryStatus
      : delivery !== undefined;
    const ingestOk =
      step.expectedIngestLogs === undefined
        ? true
        : lastIngestLogs >= step.expectedIngestLogs;

    if (deliveryOk && ingestOk) {
      return {
        deliveryId: replayResult.deliveryId,
        deliveryStatus: lastStatus,
        ingestLogs: lastIngestLogs,
        provider: replayResult.provider,
      };
    }

    await sleep(pollIntervalMs);
  }

  throw new AssertionTimeoutError(
    `Timed out waiting for replay ${replayResult.deliveryId} ` +
      `(status=${lastStatus ?? "missing"}, ingestLogs=${lastIngestLogs})`,
    {
      deliveryId: replayResult.deliveryId,
      elapsedMs: Date.now() - startedAt,
      lastIngestLogs,
      lastStatus,
      provider: replayResult.provider,
      scenario: scenario.name,
      url: replayResult.url,
    }
  );
}

export async function assertScenario(
  scenario: LocalE2EScenario,
  replayResults: ReplayResult[],
  options: AssertionOptions = {}
): Promise<AssertionResult[]> {
  const results: AssertionResult[] = [];

  for (const replayResult of replayResults) {
    results.push(await assertReplayResult(scenario, replayResult, options));
  }

  return results;
}
