import { describe, expect, it } from "vitest";

import {
  createAgentNodeMetadata,
  defineAgentGraph,
} from "../../telemetry/metadata";

describe("agent graph metadata", () => {
  it("derives node metadata from the graph registry and omits undefined fields", () => {
    const graph = defineAgentGraph({
      id: "signal-intake",
      routerId: "signals",
      version: "v1",
      nodes: {
        signalClassifier: {
          feature: "signals",
          id: "signal-classifier",
          kind: "llm",
          promptId: "signal-classifier",
          role: "router",
          schemaVersion: "signal.classification.v2",
          workflow: "classify-signal",
        },
        peopleClassifier: {
          feature: "people",
          id: "people-classifier",
          kind: "llm",
          promptId: "people-classifier",
          role: "extractor",
          schemaVersion: "people.classification.v1",
          upstreamNodeIds: ["signal-classifier"],
          workflow: "classify-people",
        },
        signalEntityLinker: {
          feature: "entity-links",
          id: "signal-entity-linker",
          kind: "llm",
          promptId: "signal-entity-linker",
          role: "extractor",
          schemaVersion: "signal.entity-links.v1",
          upstreamNodeIds: ["signal-classifier"],
          workflow: "index-signal-entities",
        },
      },
    });

    expect(
      createAgentNodeMetadata(graph, graph.nodes.signalClassifier, {
        agentRunId: "sig_123",
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        inputLength: 42,
      })
    ).toEqual({
      agentGraphId: "signal-intake",
      agentGraphVersion: "v1",
      agentRunId: "sig_123",
      clerkOrgId: "org_test",
      deploymentEnvironment: "production",
      feature: "signals",
      inputLength: 42,
      nodeId: "signal-classifier",
      nodeKind: "llm",
      nodeRole: "router",
      promptId: "signal-classifier",
      routerId: "signals",
      schemaVersion: "signal.classification.v2",
      workflow: "classify-signal",
    });

    expect(
      createAgentNodeMetadata(graph, graph.nodes.peopleClassifier, {
        agentRunId: "sig_123",
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        inputLength: 42,
      })
    ).toEqual({
      agentGraphId: "signal-intake",
      agentGraphVersion: "v1",
      agentRunId: "sig_123",
      clerkOrgId: "org_test",
      deploymentEnvironment: "production",
      feature: "people",
      inputLength: 42,
      nodeId: "people-classifier",
      nodeKind: "llm",
      nodeRole: "extractor",
      promptId: "people-classifier",
      routerId: "signals",
      schemaVersion: "people.classification.v1",
      upstreamNodeId: "signal-classifier",
      workflow: "classify-people",
    });

    expect(
      createAgentNodeMetadata(graph, graph.nodes.signalEntityLinker, {
        agentRunId: "sig_123",
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        inputLength: 42,
      })
    ).toEqual({
      agentGraphId: "signal-intake",
      agentGraphVersion: "v1",
      agentRunId: "sig_123",
      clerkOrgId: "org_test",
      deploymentEnvironment: "production",
      feature: "entity-links",
      inputLength: 42,
      nodeId: "signal-entity-linker",
      nodeKind: "llm",
      nodeRole: "extractor",
      promptId: "signal-entity-linker",
      routerId: "signals",
      schemaVersion: "signal.entity-links.v1",
      upstreamNodeId: "signal-classifier",
      workflow: "index-signal-entities",
    });
  });
});
