import type { LoadedFixture, ReplayRequest } from "../types";
import { getSandboxProvider } from "./providers";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name} for local replay signing`
    );
  }
  return value;
}

export function buildReplayRequest(fixture: LoadedFixture): ReplayRequest {
  return getSandboxProvider(fixture.provider).buildSignedRequest(fixture);
}
