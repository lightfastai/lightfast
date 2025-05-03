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

  // Determine success/failure state
  const isSuccess = toolState === "result" || toolState === "success";
  const isError = toolState === "error" || toolState === "failed";
  const isPending = toolState === "call" || toolState === "calling";

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

            {(isSuccess || isError) && (
              <AccordionItem
                value={`${accordionId}-result`}
                className="border-b-0"
              >
                <AccordionTrigger className="py-2">
                  <div className="flex items-center gap-2">
                    {isSuccess ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>{isSuccess ? "Result" : "Error"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <pre
                    className={cn(
                      "overflow-auto rounded p-2 text-xs",
                      isSuccess ? "bg-muted" : "bg-red-100 dark:bg-red-900",
                    )}
                  >
                    {isSuccess ? resultString : formatJsonDisplay(error)}
                  </pre>
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
