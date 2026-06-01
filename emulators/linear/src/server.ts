import { type StartedEmulator, startEmulator } from "@repo/emulator-kit";

import { linearPlugin } from "./plugin";

export interface StartLinearEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedLinearEmulator = StartedEmulator;

export function startLinearEmulator(
  input: StartLinearEmulatorInput = {}
): Promise<StartedLinearEmulator> {
  return startEmulator(linearPlugin, {
    appOrigin: input.appOrigin,
    host: input.host,
    port: input.port ?? 4568,
    publicOrigin: input.publicOrigin,
  });
}
