import { describe, expect, it } from "vitest";

import { signalIntakeAgentGraph } from "../../../_internal/agent-graphs/signal-intake";

describe("signalIntakeAgentGraph", () => {
  it("defines the routed signal to people classifier topology", () => {
    expect(signalIntakeAgentGraph).toMatchObject({
      id: "signal-intake",
      routerId: "signals",
      nodes: {
        signalClassifier: {
          id: "signal-classifier",
          role: "router",
          schemaVersion: "signal.classification.v2",
        },
        peopleClassifier: {
          id: "people-classifier",
          role: "extractor",
          upstreamNodeIds: ["signal-classifier"],
        },
      },
    });
  });
});
