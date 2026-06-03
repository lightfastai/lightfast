import { type StartedEmulator, startEmulator } from "@repo/emulator-kit";

import { xPlugin } from "./plugin";

export interface StartXEmulatorInput {
  callbackUrl?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedXEmulator = StartedEmulator;

export function startXEmulator(
  input: StartXEmulatorInput = {}
): Promise<StartedXEmulator> {
  return startEmulator(xPlugin, {
    callbackUrl: input.callbackUrl,
    host: input.host,
    port: input.port ?? 4569,
    publicOrigin: input.publicOrigin,
  });
}
