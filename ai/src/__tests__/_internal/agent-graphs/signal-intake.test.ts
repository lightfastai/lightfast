import { describe, expect, it } from "vitest";

import { signalIntakeAgentGraph } from "../../../_internal/agent-graphs/signal-intake";

describe("signalIntakeAgentGraph", () => {
  it("defines the routed signal intake topology", () => {
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
        signalEntityLinker: {
          id: "signal-entity-linker",
          role: "extractor",
          schemaVersion: "signal.entity-links.v1",
          upstreamNodeIds: ["signal-classifier"],
        },
      },
    });
  });
});
