import { type StartedEmulator, startEmulator } from "@repo/emulator-kit";

import { xPlugin } from "./x-plugin";

export interface StartXEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedXEmulator = StartedEmulator;

export function startXEmulator(
  input: StartXEmulatorInput = {}
): Promise<StartedXEmulator> {
  return startEmulator(xPlugin, {
    appOrigin: input.appOrigin,
    host: input.host,
    port: input.port ?? 4569,
    publicOrigin: input.publicOrigin,
  });
}
