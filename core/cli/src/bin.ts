declare const __CLI_VERSION__: string;

import { formatCliError } from "./auth/errors";
import { createProgram } from "./program";

createProgram({ version: __CLI_VERSION__ })
  .parseAsync()
  .catch((error: unknown) => {
    process.stderr.write(`${formatCliError(error)}\n`);
    process.exitCode = 1;
  });
