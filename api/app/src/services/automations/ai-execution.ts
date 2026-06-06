import type {
  Automation,
  AutomationRun,
  AutomationRunTrigger,
  AutomationScheduleConfig,
  AutomationScheduleKind,
} from "@db/app";
import type { ConnectableConnectorProvider } from "@repo/connector-contract";
import {
  providerRoutineCallFailureSchema,
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";
import { gateway, generateText, stepCountIs, tool } from "@vendor/ai";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import {
  AutomationExecutionError,
  type AutomationExecutionErrorCode,
  automationExecutionError,
} from "./errors";
import {
  type AutomationRunAiOutput,
  buildAutomationRunOutput,
  createAutomationTranscriptRecorder,
} from "./output";
import {
  type AutomationProviderRoutineContext,
  callAutomationProviderRoutine,
  findAutomationProviderRoutines,
} from "./provider-routines";

export const AUTOMATION_RUN_MODEL = "anthropic/claude-sonnet-4.6";
export const AUTOMATION_RUN_FALLBACK_MODELS = ["openai/gpt-5.4"] as const;
export const AUTOMATION_RUN_MAX_TOOL_STEPS = 5;

const automationProviderRoutineCallOutputSchema = z.union([
  providerRoutineCallSuccessSchema,
  providerRoutineCallFailureSchema,
]);

export interface ExecuteAutomationRunInput {
  automation: ExecuteAutomationRunAutomation;
  deploymentEnvironment: string;
  now?: () => Date;
  run: ExecuteAutomationRunRecord;
}

export type ExecuteAutomationRunAutomation = Pick<
  Automation,
  | "clerkOrgId"
  | "connectorProvider"
  | "createdByUserId"
  | "name"
  | "prompt"
  | "publicId"
  | "scheduleConfig"
  | "scheduleKind"
  | "timezone"
> & {
  connectorProvider: ConnectableConnectorProvider | null;
  scheduleConfig: AutomationScheduleConfig;
  scheduleKind: AutomationScheduleKind;
};

export type ExecuteAutomationRunRecord = Pick<
  AutomationRun,
  "publicId" | "trigger"
> & {
  trigger: AutomationRunTrigger;
};

export async function executeAutomationRun(
  input: ExecuteAutomationRunInput
): Promise<AutomationRunAiOutput> {
  const now = input.now ?? (() => new Date());
  const startedAt = now();
  const currentTime = startedAt;
  const selectedProvider = input.automation.connectorProvider;
  const context = selectedProvider
    ? providerRoutineContext(input, selectedProvider)
    : null;
  const metadata = automationRunTelemetryMetadata(input);
  const toolFailureState = createAutomationToolFailureState();

  try {
    if (context) {
      const preflight = await findAutomationProviderRoutines(context, {
        includeSchema: true,
        limit: 1,
      });

      if (preflight.routines.length === 0) {
        if (preflight.reason === "no_enabled_providers") {
          throw automationExecutionError({
            code: "AUTOMATION_CONNECTOR_NOT_ENABLED",
            message: "The selected connector is not enabled for automations.",
          });
        }

        throw automationExecutionError({
          code: "AUTOMATION_CONNECTOR_NO_TOOLS",
          message:
            "The selected connector has no automation routines available.",
        });
      }
    }

    const system = buildAutomationSystemPrompt(input);
    const prompt = buildAutomationPrompt(input, currentTime);
    const recorder = createAutomationTranscriptRecorder(now);
    recorder.recordSystem(system);
    recorder.recordUser(input.automation.prompt);

    const result = await generateText({
      experimental_telemetry: {
        functionId: "automation.run",
        isEnabled: true,
        metadata,
        recordInputs: false,
        recordOutputs: false,
      },
      model: gateway(AUTOMATION_RUN_MODEL),
      prompt,
      providerOptions: {
        gateway: {
          cacheControl: "max-age=0",
          models: [...AUTOMATION_RUN_FALLBACK_MODELS],
          tags: automationRunGatewayTags(input),
          user: input.automation.createdByUserId,
        },
      },
      stopWhen: context
        ? stepCountIs(AUTOMATION_RUN_MAX_TOOL_STEPS)
        : undefined,
      system,
      tools: context
        ? createAutomationProviderRoutineTools({
            context,
            recorder,
            toolFailureState,
          })
        : undefined,
    });
    throwCapturedToolFailure(toolFailureState);

    const finalText = result.text.trim();
    if (!finalText) {
      throw automationExecutionError({
        code: "AUTOMATION_EMPTY_OUTPUT",
        message: "Automation completed without a final model response.",
      });
    }

    recorder.recordAssistant(finalText);

    const output = buildAutomationRunOutput({
      automation: input.automation,
      finishedAt: now(),
      model: AUTOMATION_RUN_MODEL,
      result: {
        finishReason: result.finishReason,
        text: finalText,
        totalUsage: result.totalUsage,
        usage: result.usage,
      },
      run: input.run,
      startedAt,
      transcriptEvents: recorder.events(),
    });

    log.info("[automations] run ai execution completed", {
      ...metadata,
      finishReason: String(result.finishReason),
      providerRoutineCallCount: output.providerRoutineCallIds.length,
    });

    return output;
  } catch (error) {
    if (toolFailureState.firstError) {
      logExecutionFailure(metadata, toolFailureState.firstError.code);
      throw toolFailureState.firstError;
    }

    if (error instanceof AutomationExecutionError) {
      logExecutionFailure(metadata, error.code);
      throw error;
    }

    logExecutionFailure(metadata, "AUTOMATION_MODEL_FAILED", error);
    throw automationExecutionError({
      cause: error,
      code: "AUTOMATION_MODEL_FAILED",
      message: "Automation model execution failed.",
    });
  }
}

function createAutomationProviderRoutineTools(input: {
  context: AutomationProviderRoutineContext;
  recorder: ReturnType<typeof createAutomationTranscriptRecorder>;
  toolFailureState: AutomationToolFailureState;
}) {
  return {
    callProviderRoutine: tool({
      description:
        "Call one selected-connector provider routine by routineId. Write routines are allowed when required by the automation prompt.",
      inputSchema: providerRoutineCallInputSchema,
      outputSchema: automationProviderRoutineCallOutputSchema,
      execute: async (toolInput) => {
        try {
          const parsed = providerRoutineCallInputSchema.parse(toolInput);
          input.recorder.recordToolCall({
            input: parsed.input,
            routineId: parsed.routineId,
            toolName: "callProviderRoutine",
          });

          const result = await callAutomationProviderRoutine(
            input.context,
            parsed
          );

          if (result.status === "succeeded") {
            input.recorder.recordToolResult({
              output: result.result,
              providerRoutineCallId: result.providerRoutineCallId,
              routineId: result.routineId,
              status: "succeeded",
              toolName: "callProviderRoutine",
            });
            return result;
          }

          input.recorder.recordToolResult({
            output: result.error,
            providerRoutineCallId: result.providerRoutineCallId,
            routineId: result.routineId,
            status: "failed",
            toolName: "callProviderRoutine",
          });
          return result;
        } catch (error) {
          input.recorder.recordToolError({
            errorCode: providerRoutineErrorCode(error),
            errorMessage: "Provider routine failed.",
            routineId: routineIdFromToolInput(toolInput),
            toolName: "callProviderRoutine",
          });
          throw captureToolFailure(input.toolFailureState, error);
        }
      },
    }),
    findProviderRoutines: tool({
      description:
        "Find selected-connector provider routines available to this automation. Use this before calling callProviderRoutine.",
      inputSchema: providerRoutineFindInputSchema,
      outputSchema: providerRoutineFindOutputSchema,
      execute: async (toolInput) => {
        try {
          const parsed = providerRoutineFindInputSchema.parse(toolInput);
          input.recorder.recordToolCall({
            input: parsed,
            toolName: "findProviderRoutines",
          });

          const result = await findAutomationProviderRoutines(input.context, {
            ...parsed,
            includeSchema: true,
            provider: input.context.selectedProvider,
          });

          input.recorder.recordToolResult({
            routineCount: result.routines.length,
            status: "succeeded",
            toolName: "findProviderRoutines",
          });

          return result;
        } catch (error) {
          input.recorder.recordToolError({
            errorCode: providerRoutineErrorCode(error),
            errorMessage: "Provider routine failed.",
            toolName: "findProviderRoutines",
          });
          throw captureToolFailure(input.toolFailureState, error);
        }
      },
    }),
  };
}

function providerRoutineContext(
  input: ExecuteAutomationRunInput,
  selectedProvider: ConnectableConnectorProvider
): AutomationProviderRoutineContext {
  return {
    automationPublicId: input.automation.publicId,
    calledByUserId: input.automation.createdByUserId,
    clerkOrgId: input.automation.clerkOrgId,
    runPublicId: input.run.publicId,
    selectedProvider,
  };
}

function buildAutomationSystemPrompt(input: ExecuteAutomationRunInput) {
  const connectorInstructions = input.automation.connectorProvider
    ? [
        `Selected connector: ${input.automation.connectorProvider}`,
        "Use only routines from the selected connector.",
        "Do not use routines from any connector other than the selected connector.",
        "Write-capable routines are allowed when needed to satisfy the automation prompt.",
        "Use findProviderRoutines before callProviderRoutine unless a valid routine id is already known from this same run.",
        "If required tools are unavailable, stop and explain the limitation.",
      ]
    : [
        "No connector selected.",
        "Provider routines are not available for this automation.",
      ];

  return [
    "You are executing a scheduled Lightfast automation.",
    `Automation: ${input.automation.name}`,
    `Run ID: ${input.run.publicId}`,
    ...connectorInstructions,
    "Return a concise final summary of what you did.",
  ].join("\n");
}

function buildAutomationPrompt(
  input: ExecuteAutomationRunInput,
  currentTime: Date
) {
  return [
    input.automation.prompt,
    "",
    "Run metadata:",
    `- Trigger: ${input.run.trigger}`,
    `- Schedule kind: ${input.automation.scheduleKind}`,
    `- Schedule config: ${JSON.stringify(input.automation.scheduleConfig)}`,
    `- Timezone: ${input.automation.timezone}`,
    `- Current time: ${currentTime.toISOString()}`,
  ].join("\n");
}

function automationRunTelemetryMetadata(input: ExecuteAutomationRunInput) {
  return {
    automationId: input.automation.publicId,
    clerkOrgId: input.automation.clerkOrgId,
    connectorProvider: input.automation.connectorProvider ?? "none",
    environment: input.deploymentEnvironment,
    model: AUTOMATION_RUN_MODEL,
    runId: input.run.publicId,
  };
}

function automationRunGatewayTags(input: ExecuteAutomationRunInput) {
  return [
    "feature:automation-run",
    `org:${input.automation.clerkOrgId}`,
    `automation:${input.automation.publicId}`,
    `run:${input.run.publicId}`,
    `connector:${input.automation.connectorProvider ?? "none"}`,
    `env:${input.deploymentEnvironment}`,
  ];
}

function providerRoutineErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "PROVIDER_ROUTINE_PROVIDER_FAILED";
}

function routineIdFromToolInput(toolInput: unknown) {
  if (
    toolInput !== null &&
    typeof toolInput === "object" &&
    "routineId" in toolInput &&
    typeof toolInput.routineId === "string"
  ) {
    return toolInput.routineId;
  }

  return;
}

interface AutomationToolFailureState {
  firstError: AutomationExecutionError | null;
}

function createAutomationToolFailureState(): AutomationToolFailureState {
  return { firstError: null };
}

function captureToolFailure(state: AutomationToolFailureState, cause: unknown) {
  const error = automationExecutionError({
    cause,
    code: "AUTOMATION_TOOL_FAILED",
    message: "Provider routine failed.",
  });

  state.firstError ??= error;
  return error;
}

function throwCapturedToolFailure(state: AutomationToolFailureState) {
  if (state.firstError) {
    throw state.firstError;
  }
}

function logExecutionFailure(
  metadata: ReturnType<typeof automationRunTelemetryMetadata>,
  errorCode: AutomationExecutionErrorCode,
  error?: unknown
) {
  const logMetadata: Record<string, unknown> = {
    ...metadata,
    errorCode,
  };

  if (error !== undefined) {
    logMetadata.errorName = error instanceof Error ? error.name : typeof error;
  }

  log.warn("[automations] run ai execution failed", logMetadata);
}
