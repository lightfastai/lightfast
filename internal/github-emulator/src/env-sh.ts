import { createGitHubEmulatorRuntimeEnv } from "./env";
import { formatGitHubEmulatorEnvShell, getGitHubEmulatorEnv } from "./fixtures";

function readOption(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

function createRuntimeEnvWithOptions(): NodeJS.ProcessEnv {
  const appOrigin = readOption("--app-origin");
  const emulatorOrigin = readOption("--emulator-origin");

  return {
    ...process.env,
    ...(appOrigin ? { LIGHTFAST_APP_ORIGIN: appOrigin } : {}),
    ...(emulatorOrigin ? { GITHUB_EMULATOR_ORIGIN: emulatorOrigin } : {}),
  };
}

const env = createGitHubEmulatorRuntimeEnv(createRuntimeEnvWithOptions());

console.log(
  formatGitHubEmulatorEnvShell(
    getGitHubEmulatorEnv(env.appOrigin, env.emulatorOrigin)
  )
);
