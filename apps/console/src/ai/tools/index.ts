import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import type { ToolFactorySet } from "@lightfastai/ai-sdk/tool";
import type { AnswerRuntimeContext } from "../types";
import { workspaceSearchTool } from "./search";
import { workspaceContentsTool } from "./contents";
import { workspaceFindSimilarTool } from "./find-similar";
import { workspaceGraphTool } from "./graph";
import { workspaceRelatedTool } from "./related";

export const answerTools: ToolFactorySet<RuntimeContext<AnswerRuntimeContext>> = {
  workspaceSearch: workspaceSearchTool(),
  workspaceContents: workspaceContentsTool(),
  workspaceFindSimilar: workspaceFindSimilarTool(),
  workspaceGraph: workspaceGraphTool(),
  workspaceRelated: workspaceRelatedTool(),
};
