import type {
  Automation,
  AutomationRun,
  AutomationRunTrigger,
  AutomationScheduleConfig,
  AutomationScheduleKind,
} from "@db/app";
import {
  type ConnectableConnectorProvider,
  decisionFindInputSchema,
  decisionFindOutputSchema,
  decisionGetInputSchema,
  decisionGetOutputSchema,
  providerRoutineCallFailureSchema,
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/api-contract";
import { gateway, generateText, stepCountIs, tool } from "@vendor/ai";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import {
  type AutomationDecisionContext,
  findAutomationDecisions,
  getAutomationDecision,
} from "./decisions";
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
const automationDecisionGetOutputSchema = decisionGetOutputSchema.nullable();

export interface ExecuteAutomationRunInput {
  automation: ExecuteAutomationRunAutomation;
  deploymentEnvironment: string;
  now?: () => Date;
  run: ExecuteAutomationRunRecord;
}

export type AutomationRunTarget = "connector" | "decisions";

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

export interface ExecuteConnectorAutomationRunInput
  extends ExecuteAutomationRunInput {
  automation: ExecuteAutomationRunAutomation & {
    connectorProvider: ConnectableConnectorProvider;
  };
}

export interface ExecuteDecisionAutomationRunInput
  extends ExecuteAutomationRunInput {
  automation: ExecuteAutomationRunAutomation & {
    connectorProvider: null;
  };
}

export async function executeAutomationRun(
  input: ExecuteAutomationRunInput
): Promise<AutomationRunAiOutput> {
  const connectorProvider = input.automation.connectorProvider;
  if (connectorProvider) {
    return executeConnectorAutomationRun({
      ...input,
      automation: {
        ...input.automation,
        connectorProvider,
      },
    });
  }

  return executeDecisionAutomationRun({
    ...input,
    automation: {
      ...input.automation,
      connectorProvider: null,
    },
  });
}

export async function executeConnectorAutomationRun(
  input: ExecuteConnectorAutomationRunInput
): Promise<AutomationRunAiOutput> {
  return executeAutomationRunForTarget(input, {
    decisionContext: null,
    providerContext: providerRoutineContext(
      input,
      input.automation.connectorProvider
    ),
    target: "connector",
  });
}

export async function executeDecisionAutomationRun(
  input: ExecuteDecisionAutomationRunInput
): Promise<AutomationRunAiOutput> {
  return executeAutomationRunForTarget(input, {
    decisionContext: automationDecisionContext(input),
    providerContext: null,
    target: "decisions",
  });
}

async function executeAutomationRunForTarget(
  input: ExecuteAutomationRunInput,
  targetInput: {
    decisionContext: AutomationDecisionContext | null;
    providerContext: AutomationProviderRoutineContext | null;
    target: AutomationRunTarget;
  }
): Promise<AutomationRunAiOutput> {
  const now = input.now ?? (() => new Date());
  const startedAt = now();
  const currentTime = startedAt;
  const { decisionContext, providerContext, target } = targetInput;
  const metadata = automationRunTelemetryMetadata(input, target);
  const toolFailureState = createAutomationToolFailureState();

  try {
    if (providerContext) {
      const preflight = await findAutomationProviderRoutines(providerContext, {
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

    const system = buildAutomationSystemPrompt(input, target);
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
          tags: automationRunGatewayTags(input, target),
          user: input.automation.createdByUserId,
        },
      },
      stopWhen:
        providerContext || decisionContext
          ? stepCountIs(AUTOMATION_RUN_MAX_TOOL_STEPS)
          : undefined,
      system,
      tools: providerContext
        ? createAutomationProviderRoutineTools({
            context: providerContext,
            recorder,
            toolFailureState,
          })
        : decisionContext
          ? createAutomationDecisionTools({
              context: decisionContext,
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

function createAutomationDecisionTools(input: {
  context: AutomationDecisionContext;
  recorder: ReturnType<typeof createAutomationTranscriptRecorder>;
  toolFailureState: AutomationToolFailureState;
}) {
  return {
    findDecisions: tool({
      description:
        "Search first-party Lightfast decisions for this organization. Use query terms, provider/status/source filters, and since/until time windows instead of inventing SQL.",
      inputSchema: decisionFindInputSchema,
      outputSchema: decisionFindOutputSchema,
      execute: async (toolInput) => {
        try {
          const parsed = decisionFindInputSchema.parse(toolInput);
          input.recorder.recordToolCall({
            input: parsed,
            toolName: "findDecisions",
          });

          const result = await findAutomationDecisions(input.context, parsed);

          input.recorder.recordToolResult({
            decisionCount: result.items.length,
            status: "succeeded",
            toolName: "findDecisions",
          });

          return result;
        } catch (error) {
          input.recorder.recordToolError({
            errorCode: decisionToolErrorCode(error),
            errorMessage: "Decision search failed.",
            toolName: "findDecisions",
          });
          throw captureToolFailure(
            input.toolFailureState,
            error,
            "Decision tool failed."
          );
        }
      },
    }),
    getDecision: tool({
      description:
        "Get full details for one first-party Lightfast decision by id after finding it with findDecisions.",
      inputSchema: decisionGetInputSchema,
      outputSchema: automationDecisionGetOutputSchema,
      execute: async (toolInput) => {
        const decisionId = decisionIdFromToolInput(toolInput);
        try {
          const parsed = decisionGetInputSchema.parse(toolInput);
          input.recorder.recordToolCall({
            decisionId: parsed.id,
            input: parsed,
            toolName: "getDecision",
          });

          const result = await getAutomationDecision(input.context, parsed);

          input.recorder.recordToolResult({
            decisionId: parsed.id,
            output: result ?? null,
            status: "succeeded",
            toolName: "getDecision",
          });

          return result ?? null;
        } catch (error) {
          input.recorder.recordToolError({
            decisionId,
            errorCode: decisionToolErrorCode(error),
            errorMessage: "Decision detail lookup failed.",
            toolName: "getDecision",
          });
          throw captureToolFailure(
            input.toolFailureState,
            error,
            "Decision tool failed."
          );
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

function automationDecisionContext(
  input: ExecuteAutomationRunInput
): AutomationDecisionContext {
  return {
    automationPublicId: input.automation.publicId,
    clerkOrgId: input.automation.clerkOrgId,
    runPublicId: input.run.publicId,
  };
}

export function getAutomationRunTarget(input: {
  connectorProvider: ConnectableConnectorProvider | null;
}): AutomationRunTarget {
  return input.connectorProvider ? "connector" : "decisions";
}

function buildAutomationSystemPrompt(
  input: ExecuteAutomationRunInput,
  target: AutomationRunTarget
) {
  const selectedProvider = input.automation.connectorProvider ?? "unknown";
  const targetInstructions =
    target === "connector"
      ? [
          `Selected connector: ${selectedProvider}`,
          "Use only routines from the selected connector.",
          "Do not use routines from any connector other than the selected connector.",
          "Write-capable routines are allowed when needed to satisfy the automation prompt.",
          "Use findProviderRoutines before callProviderRoutine unless a valid routine id is already known from this same run.",
          "If required tools are unavailable, stop and explain the limitation.",
        ]
      : [
          "Selected target: Decisions.",
          "Use findDecisions to search first-party decision history.",
          "Use getDecision only when a compact decision summary is not enough.",
          "Decision tools are typed search/read tools; do not generate SQL or ask for raw database access.",
          "Provider routines and connector actions are not available for this automation.",
        ];

  return [
    "You are executing a scheduled Lightfast automation.",
    `Automation: ${input.automation.name}`,
    `Run ID: ${input.run.publicId}`,
    `Target: ${target}`,
    ...targetInstructions,
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

function automationRunTelemetryMetadata(
  input: ExecuteAutomationRunInput,
  target: AutomationRunTarget
) {
  return {
    automationId: input.automation.publicId,
    clerkOrgId: input.automation.clerkOrgId,
    connectorProvider: input.automation.connectorProvider ?? "none",
    environment: input.deploymentEnvironment,
    model: AUTOMATION_RUN_MODEL,
    runId: input.run.publicId,
    target,
  };
}

function automationRunGatewayTags(
  input: ExecuteAutomationRunInput,
  target: AutomationRunTarget
) {
  return [
    "feature:automation-run",
    `org:${input.automation.clerkOrgId}`,
    `automation:${input.automation.publicId}`,
    `run:${input.run.publicId}`,
    `target:${target}`,
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

function decisionIdFromToolInput(toolInput: unknown) {
  if (
    toolInput !== null &&
    typeof toolInput === "object" &&
    "id" in toolInput &&
    typeof toolInput.id === "string"
  ) {
    return toolInput.id;
  }

  return;
}

function decisionToolErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "DECISION_TOOL_FAILED";
}

interface AutomationToolFailureState {
  firstError: AutomationExecutionError | null;
}

function createAutomationToolFailureState(): AutomationToolFailureState {
  return { firstError: null };
}

function captureToolFailure(
  state: AutomationToolFailureState,
  cause: unknown,
  message = "Provider routine failed."
) {
  const error = automationExecutionError({
    cause,
    code: "AUTOMATION_TOOL_FAILED",
    message,
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
