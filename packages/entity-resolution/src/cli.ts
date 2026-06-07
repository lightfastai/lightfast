import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import {
  resolveKnownXGitHubPairFixture,
  resolveSimulatedEntityFixture,
  serializeEntityResolutionResult,
} from "./index";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    compact: {
      type: "boolean",
      default: false,
    },
    output: {
      type: "string",
      short: "o",
    },
    fixture: {
      type: "string",
      short: "f",
      default: "simulated",
    },
  },
});

const result =
  values.fixture === "known-pairs"
    ? resolveKnownXGitHubPairFixture()
    : resolveSimulatedEntityFixture();
const json = serializeEntityResolutionResult(result, {
  pretty: values.compact !== true,
});

if (values.output) {
  await writeFile(values.output, json);
} else {
  process.stdout.write(json);
}
