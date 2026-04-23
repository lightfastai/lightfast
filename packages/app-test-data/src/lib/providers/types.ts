import type { LoadedFixture, ReplayRequest } from "../../types";

export interface SandboxProvider {
  buildSignedRequest(fixture: LoadedFixture): ReplayRequest;
  deriveInboundEventType(fixture: LoadedFixture): string;
  overrideResourceId(fixture: LoadedFixture, resourceId: string): LoadedFixture;
  readonly requiredEnvVars: readonly string[];
}
