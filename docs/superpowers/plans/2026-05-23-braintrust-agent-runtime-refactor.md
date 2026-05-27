# Braintrust Agent Runtime Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Braintrust from a signal-specific project parent to a shared Lightfast agent runtime parent, and add stable graph/node metadata to routed AI classifier spans.

**Architecture:** `@repo/ai/telemetry` owns Lightfast AI telemetry constants plus generic graph/node metadata helpers. `ai/src/_internal/agent-graphs/signal-intake.ts` owns the signal-to-people classifier topology, and classifier packages derive span metadata from that graph registry instead of assembling loose prompt constants. `@vendor/braintrust` remains domain-agnostic and `apps/app` imports only the neutral AI telemetry parent.

**Tech Stack:** pnpm workspace, TypeScript, Vitest, Vercel AI SDK telemetry, Braintrust OTel exporter, Next.js app instrumentation.

---

## File Structure

- Create `ai/src/telemetry/braintrust.ts`: shared Braintrust project and parent constants.
- Create `ai/src/telemetry/metadata.ts`: shared graph/node metadata types plus `defineAgentGraph()` and `createAgentNodeMetadata()`.
- Create `ai/src/telemetry/index.ts`: public telemetry subpath barrel.
- Create `ai/src/__tests__/telemetry/braintrust.test.ts`: tests for the shared Braintrust parent.
- Create `ai/src/__tests__/telemetry/metadata.test.ts`: tests for graph-derived node metadata.
- Create `ai/src/_internal/agent-graphs/signal-intake.ts`: signal-intake graph registry.
- Create `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts`: topology test for signal-to-people routing.
- Modify `ai/package.json`: export `./telemetry`.
- Modify `apps/app/src/instrumentation.ts`: import Braintrust parent from `@repo/ai/telemetry`.
- Modify signal and people classifier constants: derive schema/prompt/workflow constants from the graph registry.
- Modify signal and people classifier runtime code: use `createAgentNodeMetadata()`.
- Modify signal and people classifier tests under `ai/src/__tests__`: assert `agentGraphId`, `agentRunId`, `routerId`, `nodeId`, `nodeKind`, `nodeRole`, and upstream relationship metadata.

## Tasks

- [x] Add tests for `LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT`.
- [x] Add tests for graph-derived node metadata.
- [x] Add tests for `signalIntakeAgentGraph` topology.
- [x] Implement `@repo/ai/telemetry` exports.
- [x] Export `@repo/ai/telemetry` from `ai/package.json`.
- [x] Move app instrumentation to `LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT`.
- [x] Add `signalIntakeAgentGraph`.
- [x] Derive signal classifier metadata from `signalIntakeAgentGraph.nodes.signalClassifier`.
- [x] Derive people classifier metadata from `signalIntakeAgentGraph.nodes.peopleClassifier`.
- [x] Preserve metadata-only telemetry and avoid prompt/model output recording.

## Verification

Run:

```bash
pnpm --filter @repo/ai test
pnpm --filter @repo/ai typecheck
pnpm --filter @vendor/braintrust test
pnpm --filter @vendor/braintrust typecheck
```

Expected: all pass.

`pnpm --filter @lightfast/app typecheck` is intentionally excluded from this plan's completion gate while unrelated native-auth work in the shared workspace imports a missing compatibility route.
