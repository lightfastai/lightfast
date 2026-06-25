import {
  type ExecuteAutomationRunInput,
  executeAutomationRun,
} from "./ai-execution";
import { getAutomationExecutionFailure } from "./errors";
import type { AutomationRunAiOutput } from "./output";

export type AutomationRunExecutionResult =
  | {
      output: AutomationRunAiOutput;
      status: "completed";
    }
  | {
      failure: ReturnType<typeof getAutomationExecutionFailure>;
      status: "failed";
    };

export async function executeAutomationRunRequest(
  input: ExecuteAutomationRunInput
): Promise<AutomationRunExecutionResult> {
  try {
    return {
      output: await executeAutomationRun(input),
      status: "completed",
    };
  } catch (error) {
    return {
      failure: getAutomationExecutionFailure(error),
      status: "failed",
    };
  }
}
