import type { EmulatorManifest } from "@repo/emulator-kit";

import { getGitHubEmulatorEnv } from "./fixtures";
import { startGitHubEmulator } from "./plugin";

export const githubManifest: EmulatorManifest = {
  name: "github",
  port: 4567,
  env: getGitHubEmulatorEnv,
  start: startGitHubEmulator,
};
