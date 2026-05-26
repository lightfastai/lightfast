export type AgentNodeKind =
  | "llm"
  | "function"
  | "router"
  | "tool"
  | "workflow"
  | "other";

export type AgentNodeRole =
  | "classifier"
  | "router"
  | "extractor"
  | "summarizer"
  | "tool"
  | "other";

export interface AgentGraphNodeDefinition {
  feature: string;
  id: string;
  kind: AgentNodeKind;
  promptId?: string;
  role: AgentNodeRole;
  schemaVersion: string;
  upstreamNodeIds?: readonly string[];
  workflow: string;
}

export interface AgentGraphDefinition<
  TNodes extends Record<string, AgentGraphNodeDefinition> = Record<
    string,
    AgentGraphNodeDefinition
  >,
> {
  id: string;
  nodes: TNodes;
  routerId?: string;
  version?: string;
}

export interface AgentNodeMetadataInput {
  agentRunId: string;
  clerkOrgId?: string;
  deploymentEnvironment: "development" | "preview" | "production";
  inputLength: number;
  routeDecision?: string;
  routeDecisionCode?: string;
  sourceEventName?: string;
}

export type AgentRuntimeMetadata = Record<
  string,
  string | number | readonly string[]
>;

export function defineAgentGraph<
  const TNodes extends Record<string, AgentGraphNodeDefinition>,
>(graph: AgentGraphDefinition<TNodes>): AgentGraphDefinition<TNodes> {
  return graph;
}

export function createAgentNodeMetadata(
  graph: AgentGraphDefinition,
  node: AgentGraphNodeDefinition,
  {
    agentRunId,
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    routeDecision,
    routeDecisionCode,
    sourceEventName,
  }: AgentNodeMetadataInput
): AgentRuntimeMetadata {
  const [upstreamNodeId] = node.upstreamNodeIds ?? [];

  return removeUndefined({
    agentGraphId: graph.id,
    agentGraphVersion: graph.version,
    agentRunId,
    clerkOrgId,
    deploymentEnvironment,
    feature: node.feature,
    inputLength,
    nodeId: node.id,
    nodeKind: node.kind,
    nodeRole: node.role,
    promptId: node.promptId,
    routeDecision,
    routeDecisionCode,
    routerId: graph.routerId,
    schemaVersion: node.schemaVersion,
    sourceEventName,
    upstreamNodeId,
    workflow: node.workflow,
  });
}

function removeUndefined(
  metadata: Record<string, string | number | readonly string[] | undefined>
): AgentRuntimeMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  ) as AgentRuntimeMetadata;
}
