import { Effect } from "effect";
import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "lightfast/agent";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import type { ModelId } from "~/ai/providers";
import { getModelConfig, getModelStreamingDelay } from "~/ai/providers";
import { BraintrustMiddleware } from "braintrust";
import { isOtelEnabled } from "lightfast/v2/braintrust-env";
import { uuidv4 } from "lightfast/v2/utils";
import { webSearchTool } from "~/ai/tools/web-search";
import { createDocumentTool } from "~/ai/tools/create-document";
import type { AppRuntimeContext } from "~/ai/lightfast-app-chat-ui-messages";
import { PlanetScaleMemory } from "~/ai/runtime/memory/planetscale";
import { AnonymousRedisMemory } from "~/ai/runtime/memory/redis";
import { env } from "~/env";
import { 
  ResourceAllocator,
  ExecutionError,
  MemoryError
} from "./effect-core";
import { ProfileUtils } from "./utils";
import type { UserProfileContext } from "./guards";

// Memory allocation context
export interface MemoryContext extends UserProfileContext {
  memory: any;
}

// Agent allocation context
export interface ResourceContext extends MemoryContext {
  agent: any;
  systemPrompt: string;
  messageId: string;
}

/**
 * MemoryAllocator - Allocates memory based on user type (preserve existing logic)
 */
export class MemoryAllocator extends ResourceAllocator<UserProfileContext, MemoryContext, MemoryError> {
  allocate(resource: UserProfileContext) {
    return Effect.gen(function* (_) {
      try {
        const memory = resource.type === "anonymous"
          ? new AnonymousRedisMemory({
              url: env.KV_REST_API_URL,
              token: env.KV_REST_API_TOKEN,
            })
          : new PlanetScaleMemory();
        
        return { ...resource, memory };
      } catch (error) {
        return yield* _(Effect.fail(new MemoryError(`Failed to create memory instance: ${error}`)));
      }
    });
  }
}

// Complete tools object for c010 agent including artifact tools
const c010Tools = {
  webSearch: webSearchTool,
  createDocument: createDocumentTool,
};

// Helper function to get actual model name for gateway
const getActualModelName = (modelId: ModelId): string => {
  const modelConfig = getModelConfig(modelId);
  return modelConfig.name;
};

/**
 * ProfileAgentAllocator - Uses complete profile (REPLACES manual config)
 */
export class ProfileAgentAllocator extends ResourceAllocator<
  MemoryContext & { selectedModel?: string },
  ResourceContext,
  ExecutionError
> {
  allocate(resource: MemoryContext & { selectedModel?: string }) {
    return Effect.try({
      try: () => {
        // Tools come directly from profile (REPLACES getActiveToolsForUser)
        const enabledTools = ProfileUtils.getEnabledTools(resource.profile.tools);
        
        // System prompt from profile (REPLACES createSystemPromptForUser)  
        const systemPrompt = ProfileUtils.createSystemPrompt(resource.profile);
        
        // Model configuration from profile
        const modelId = resource.selectedModel || resource.profile.modelAccess.defaultModel;
        
        const agent = createAgent<AppRuntimeContext, typeof c010Tools>({
          name: "c010",
          system: systemPrompt,
          tools: c010Tools,
          activeTools: enabledTools as (keyof typeof c010Tools)[],
          createRuntimeContext: ({ sessionId, resourceId }): AppRuntimeContext => ({
            userId: resource.userId,
            agentId: resource.agentId,
            messageId: resource.messageId,
          }),
          model: wrapLanguageModel({
            model: gateway(getActualModelName(modelId as ModelId)),
            middleware: BraintrustMiddleware({ debug: true }),
          }),
          experimental_transform: smoothStream({
            delayInMs: getModelStreamingDelay(modelId as ModelId),
            chunking: "word",
          }),
          stopWhen: stepCountIs(10),
          experimental_telemetry: {
            isEnabled: isOtelEnabled(),
            metadata: {
              agentId: resource.agentId,
              agentName: "c010",
              sessionId: resource.sessionId,
              userId: resource.userId,
              modelId,
            },
          },
        });

        return {
          ...resource,
          agent,
          systemPrompt,
          messageId: resource.messageId || uuidv4(),
        };
      },
      catch: (error) => new ExecutionError(`Failed to create agent: ${error}`, error),
    });
  }
}