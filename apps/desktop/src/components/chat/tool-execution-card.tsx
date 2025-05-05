import { useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Code,
  Terminal,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";

interface ToolExecutionCardProps {
  toolName: string;
  toolState: string;
  args: any;
  result?: any;
  error?: any;
  messageId: string;
  toolCallId: string;
}

export function ToolExecutionCard({
  toolName,
  toolState,
  args,
  result,
  error,
  messageId,
  toolCallId,
}: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Make sure args is an object
  const safeArgs = args && typeof args === "object" ? args : {};

  // Format the arguments for display
  const argsString = formatJsonDisplay(safeArgs);

  // Format the result for display
  let resultDisplay = result;
  if (typeof result === "string") {
    try {
      resultDisplay = JSON.parse(result);
    } catch (e) {
      // Use as is if not valid JSON
    }
  }

  const resultString = formatJsonDisplay(resultDisplay);

  // Extract code from args if it's a Blender execution
  // Handle both cases: { code: "..." } and { args: { code: "..." } }
  const code =
    toolName === "executeBlenderCode" &&
    (safeArgs.code || (safeArgs.args && safeArgs.args.code));

  // --- Enhanced error/success/pending detection ---
  let isError = false;
  let isSuccess = false;
  let isPending = false;
  let errorMessage = "";
  let errorCode = "";

  if (toolState === "error" || toolState === "failed") {
    isError = true;
    errorMessage = error?.error || error?.message || String(error);
    errorCode = error?.errorCode;
  } else if (toolState === "result") {
    if (resultDisplay && typeof resultDisplay === "object") {
      if (resultDisplay.success === false) {
        isError = true;
        errorMessage =
          resultDisplay.error ||
          resultDisplay.message ||
          JSON.stringify(resultDisplay);
        errorCode = resultDisplay.errorCode;
      } else if (resultDisplay.error) {
        isError = true;
        errorMessage = resultDisplay.error;
        errorCode = resultDisplay.errorCode;
      } else {
        isSuccess = true;
      }
    } else {
      isSuccess = true;
    }
  } else if (toolState === "success") {
    isSuccess = true;
  } else if (toolState === "call" || toolState === "calling") {
    isPending = true;
  }

  // Create unique ID for accordion
  const accordionId = `${messageId}-${toolCallId}`;

  return (
    <Card className="my-2 overflow-hidden border p-0">
      <div
        className={cn(
          "flex items-center justify-between gap-2 p-3",
          isPending && "bg-blue-50 dark:bg-blue-950",
          isSuccess && "bg-green-50 dark:bg-green-950",
          isError && "bg-red-50 dark:bg-red-950",
        )}
      >
        <div className="flex items-center gap-2">
          {isPending && <Terminal className="h-4 w-4 text-blue-500" />}
          {isSuccess && <CheckCircle className="h-4 w-4 text-green-500" />}
          {isError && <AlertCircle className="h-4 w-4 text-red-500" />}

          <div>
            <div className="font-medium">{toolName || "Tool"}</div>
            <div className="text-muted-foreground text-xs">
              {isPending && "Running..."}
              {isSuccess && "Completed successfully"}
              {isError && "Failed to execute"}
            </div>
          </div>
        </div>

        <button
          className="text-muted-foreground hover:text-foreground rounded p-1"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t p-3">
          <Accordion type="single" collapsible className="w-full">
            {code && (
              <AccordionItem
                value={`${accordionId}-code`}
                className="border-b-0"
              >
                <AccordionTrigger className="py-2">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <span>Code</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="bg-muted overflow-auto rounded p-2 text-xs">
                    {code}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value={`${accordionId}-args`} className="border-b-0">
              <AccordionTrigger className="py-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  <span>Arguments</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <pre className="bg-muted overflow-auto rounded p-2 text-xs">
                  {argsString}
                </pre>
              </AccordionContent>
            </AccordionItem>

            {isSuccess && (
              <AccordionItem
                value={`${accordionId}-result`}
                className="border-b-0"
              >
                <AccordionTrigger className="py-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Result</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="bg-muted overflow-auto rounded p-2 text-xs">
                    {resultString}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            )}

            {isError && (
              <AccordionItem
                value={`${accordionId}-error`}
                className="border-b-0"
              >
                <AccordionTrigger className="py-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Error</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-auto rounded bg-red-100 p-2 text-xs text-red-700 dark:bg-red-900 dark:text-red-200">
                    {errorMessage}
                    {errorCode && (
                      <div className="mt-1 text-red-400">
                        Error code: {errorCode}
                      </div>
                    )}
                    {errorCode === "BLENDER_NOT_CONNECTED" && (
                      <div className="mt-2 text-xs text-red-500 dark:text-red-300">
                        Blender is not connected. Please open Blender and ensure
                        the connection is active.
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      )}
    </Card>
  );
}

// Helper function to format JSON for display
function formatJsonDisplay(data: any): string {
  if (!data) return "No data";

  try {
    if (typeof data === "string") {
      // Try to parse it as JSON first
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Not JSON, return as is
        return data;
      }
    } else {
      return JSON.stringify(data, null, 2);
    }
  } catch (e) {
    return String(data);
  }
}
