import { parseArgs } from "node:util";

import {
  checkEntityResolutionAgainstGolden,
  loadSimulatedGoldenFixture,
} from "./golden";
import { resolveSimulatedEntityFixture } from "./index";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    fixture: {
      type: "string",
      short: "f",
      default: "simulated",
    },
  },
});

if (values.fixture === "simulated") {
  const expected = await loadSimulatedGoldenFixture();
  const actual = resolveSimulatedEntityFixture();
  const check = checkEntityResolutionAgainstGolden(actual, expected);

  if (check.passed) {
    process.stdout.write(
      "PASS simulated fixture matches golden expectations\n"
    );
  } else {
    process.stdout.write("FAIL simulated fixture drifted\n");
    for (const issue of check.issues) {
      process.stdout.write(`FAIL ${issue.path} - ${issue.message}\n`);
    }
    process.exitCode = 1;
  }
} else {
  process.stderr.write(
    `Unsupported fixture "${values.fixture}". Only "simulated" has a golden file.\n`
  );
  process.exitCode = 2;
}
