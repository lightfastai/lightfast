import type { InferUITools } from "ai";
import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { ToolFactorySet } from "lightfast/tool";

import type { ConsoleAppRuntimeContext } from "@repo/console-types";
import { runCodingTool } from "./run-coding-tool";

// Helper type to extract the tool type from a tool factory function
type ExtractToolType<T> = T extends (...args: unknown[]) => (
    context: RuntimeContext<ConsoleAppRuntimeContext>,
) => infer R
    ? R
    : never;

// Complete tools object for Console agent
export const consoleTools: ToolFactorySet<RuntimeContext<ConsoleAppRuntimeContext>> =
    {
        run_coding_tool: runCodingTool(),
    };

// Define the actual tool set type using type inference
export type ActualLightfastAppConsoleToolSet = InferUITools<{
  run_coding_tool: ExtractToolType<typeof runCodingTool>;
}>;
