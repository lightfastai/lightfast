import { createXEmulatorRuntimeEnv } from "./env";
import { formatXEmulatorEnvString, getXEmulatorEnv } from "./fixtures";

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
    ...(emulatorOrigin ? { X_EMULATOR_ORIGIN: emulatorOrigin } : {}),
  };
}

const env = createXEmulatorRuntimeEnv(createRuntimeEnvWithOptions());

console.log(
  formatXEmulatorEnvString(getXEmulatorEnv(env.appOrigin, env.emulatorOrigin))
);
