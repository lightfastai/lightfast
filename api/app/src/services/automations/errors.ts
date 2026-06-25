export const AUTOMATION_EXECUTION_ERROR_CODES = [
  "AUTOMATION_CONNECTOR_REQUIRED",
  "AUTOMATION_CONNECTOR_NOT_ENABLED",
  "AUTOMATION_CONNECTOR_NO_TOOLS",
  "AUTOMATION_MODEL_FAILED",
  "AUTOMATION_EMPTY_OUTPUT",
  "AUTOMATION_TOOL_FAILED",
] as const;

export type AutomationExecutionErrorCode =
  (typeof AUTOMATION_EXECUTION_ERROR_CODES)[number];

export class AutomationExecutionError extends Error {
  readonly code: AutomationExecutionErrorCode;

  constructor(input: {
    cause?: unknown;
    code: AutomationExecutionErrorCode;
    message: string;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "AutomationExecutionError";
    this.code = input.code;
  }
}

export function automationExecutionError(input: {
  cause?: unknown;
  code: AutomationExecutionErrorCode;
  message: string;
}) {
  return new AutomationExecutionError(input);
}

export function getAutomationExecutionFailure(error: unknown): {
  errorCode: AutomationExecutionErrorCode;
  errorMessage: string;
} {
  if (error instanceof AutomationExecutionError) {
    return {
      errorCode: error.code,
      errorMessage: error.message,
    };
  }

  return {
    errorCode: "AUTOMATION_MODEL_FAILED",
    errorMessage: "Automation model execution failed.",
  };
}
