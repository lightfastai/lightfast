import { resolveBaseUrl } from "./config";
import { loadFixture, overrideFixtureResourceId } from "./lib/fixtures";
import { buildReplayRequest } from "./lib/signing";
import type {
  LocalE2EScenario,
  ReplayOptions,
  ReplayResult,
  ScenarioReplayStep,
} from "./types";

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function replayStep(
  step: ScenarioReplayStep,
  options: ReplayOptions = {}
): Promise<ReplayResult> {
  let fixture = loadFixture(step.fixture);
  if (step.resourceIdOverride) {
    fixture = overrideFixtureResourceId(fixture, step.resourceIdOverride);
  }
  const request = buildReplayRequest(fixture);
  const target = step.target ?? options.target ?? "platform";
  const baseUrl = resolveBaseUrl(target, options.baseUrl);
  const url = `${baseUrl}/api/ingest/${fixture.provider}`;

  const response = await fetch(url, {
    method: "POST",
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(10_000),
  });

  const body = await parseResponseBody(response);
  const acceptedDeliveryId =
    body &&
    typeof body === "object" &&
    "deliveryId" in body &&
    typeof body.deliveryId === "string"
      ? body.deliveryId
      : null;

  return {
    provider: fixture.provider,
    fixtureRef: fixture.fixtureRef,
    eventKey: fixture.eventKey,
    target,
    url,
    deliveryId: request.deliveryId,
    inboundEventType: request.inboundEventType,
    status: response.status,
    body,
    acceptedDeliveryId,
  };
}

export async function replayScenario(
  scenario: LocalE2EScenario,
  options: ReplayOptions = {}
): Promise<ReplayResult[]> {
  const results: ReplayResult[] = [];

  for (const step of scenario.replays) {
    results.push(await replayStep(step, options));
  }

  return results;
}
