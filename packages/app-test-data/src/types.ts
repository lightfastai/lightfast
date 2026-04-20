import type { ProviderSlug } from "@repo/app-providers";

export type ReplayTarget = "app" | "platform";

export interface ScenarioConnection {
  installationExternalId: string;
  installationStatus?: "active" | "error" | "pending" | "revoked";
  integrationStatus?: string;
  provider: ProviderSlug;
  providerResourceId?: string;
  resourceIdFromFixture?: string;
  syncEvents?: string[];
}

export interface ScenarioReplayStep {
  expectedDeliveryStatus?: "processed" | "received" | "skipped";
  expectedIngestLogs?: number;
  fixture: string;
  resourceIdOverride?: string;
  target?: ReplayTarget;
}

export interface LocalE2EScenario {
  clerkOrgId: string;
  clerkUserId: string;
  connections: ScenarioConnection[];
  description: string;
  name: string;
  replays: ScenarioReplayStep[];
}

export interface LoadedFixture {
  eventKey: string;
  fixturePath: string;
  fixtureRef: string;
  payload: Record<string, unknown>;
  provider: ProviderSlug;
}

export interface SeededConnection {
  installationExternalId: string;
  installationId: string;
  provider: ProviderSlug;
  providerResourceId: string;
}

export interface ReplayRequest {
  body: string;
  deliveryId: string;
  headers: Record<string, string>;
  inboundEventType: string;
}

export interface ReplayResult {
  acceptedDeliveryId: string | null;
  body: unknown;
  deliveryId: string;
  eventKey: string;
  fixtureRef: string;
  inboundEventType: string;
  provider: ProviderSlug;
  status: number;
  target: ReplayTarget;
  url: string;
}

export interface AssertionResult {
  deliveryId: string;
  deliveryStatus: string | null;
  ingestLogs: number;
  provider: ProviderSlug;
}

export interface ReplayOptions {
  baseUrl?: string;
  target?: ReplayTarget;
}

export interface AssertionOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface RunScenarioResult {
  assertions: AssertionResult[];
  replayResults: ReplayResult[];
  seededConnections: SeededConnection[];
}
