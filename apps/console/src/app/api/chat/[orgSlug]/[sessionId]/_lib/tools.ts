import type { InferUITools } from "ai";
import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { ToolFactorySet } from "lightfast/tool";

import type { DeusAppRuntimeContext } from "@repo/deus-types";
import { runCodingTool } from "./run-coding-tool";

// Helper type to extract the tool type from a tool factory function
type ExtractToolType<T> = T extends (...args: unknown[]) => (
	context: RuntimeContext<DeusAppRuntimeContext>,
) => infer R
	? R
	: never;

// Complete tools object for Deus agent
export const deusTools: ToolFactorySet<RuntimeContext<DeusAppRuntimeContext>> =
	{
		run_coding_tool: runCodingTool(),
	};

// Define the actual tool set type using type inference
export type ActualLightfastAppDeusToolSet = InferUITools<{
  run_coding_tool: ExtractToolType<typeof runCodingTool>;
}>;
