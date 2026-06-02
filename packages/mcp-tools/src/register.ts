import type { McpServer } from "@vendor/mcp";

import {
  createLightfastMcpToolDefinitions,
  type LightfastMcpToolDefinition,
} from "./policy";
import { formatMcpError, formatMcpSuccess } from "./results";

export interface LightfastMcpToolExecuteInput {
  contractPath: string;
  input: unknown;
  tool: LightfastMcpToolDefinition;
}

export type LightfastMcpToolExecute = (
  input: LightfastMcpToolExecuteInput
) => Promise<unknown>;

export function registerLightfastMcpTools(
  server: McpServer,
  input: {
    contract: Record<string, unknown>;
    execute: LightfastMcpToolExecute;
    policy: Parameters<typeof createLightfastMcpToolDefinitions>[0]["policy"];
  }
): void {
  const tools = createLightfastMcpToolDefinitions({
    contract: input.contract,
    policy: input.policy,
  });

  for (const tool of tools) {
    const config: Record<string, unknown> = {
      description: tool.description,
    };
    if (tool.inputSchema) {
      config.inputSchema = tool.inputSchema;
    }
    if (tool.outputSchema) {
      config.outputSchema = tool.outputSchema;
    }

    server.registerTool(
      tool.name,
      config as never,
      (async (...args: unknown[]) => {
        try {
          const callInput = tool.inputSchema ? args[0] : undefined;
          const result = await input.execute({
            contractPath: tool.contractPath,
            input: callInput,
            tool,
          });
          return formatMcpSuccess(result);
        } catch (error) {
          return formatMcpError(error);
        }
      }) as never
    );
  }
}
