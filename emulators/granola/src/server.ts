import { type StartedEmulator, startEmulator } from "@repo/emulator-kit";

import { granolaPlugin } from "./plugin";

export interface StartGranolaEmulatorInput {
  callbackUrl?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedGranolaEmulator = StartedEmulator;

export function startGranolaEmulator(
  input: StartGranolaEmulatorInput = {}
): Promise<StartedGranolaEmulator> {
  return startEmulator(granolaPlugin, {
    callbackUrl: input.callbackUrl,
    host: input.host,
    port: input.port ?? 4570,
    publicOrigin: input.publicOrigin,
  });
}
