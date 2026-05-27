import { describe, expect, it } from "vitest";

import {
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT,
} from "../../telemetry/braintrust";

describe("Braintrust runtime project", () => {
  it("uses the shared Lightfast agent runtime project parent", () => {
    expect(LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT).toBe(
      "lightfast-agent-runtime"
    );
    expect(LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT).toBe(
      "project_name:lightfast-agent-runtime"
    );
  });
});
