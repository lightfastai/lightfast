"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useState } from "react";
import { ChatErrorHandler } from "~/lib/chat-error-handler";
import { Bug, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { env } from "~/env";

interface ErrorTestPanelProps {
  onTriggerError?: (error: unknown) => void;
}

const ERROR_SCENARIOS = [
  { id: "rate-limit", label: "Rate Limit (429)", description: "Too many requests" },
  { id: "bot-detection", label: "Bot Detection (403)", description: "Automated activity detected" },
  { id: "model-access-denied", label: "Model Access Denied (403)", description: "Requires authentication" },
  { id: "network-error", label: "Network Timeout", description: "Connection timeout" },
  { id: "invalid-request", label: "Invalid Request (400)", description: "Bad request format" },
  { id: "authentication", label: "Authentication (401)", description: "Not authenticated" },
  { id: "model-unavailable", label: "Model Unavailable (503)", description: "Model is down" },
  { id: "server-error", label: "Server Error (500)", description: "Internal error" },
  { id: "no-content", label: "No Content Generated", description: "Empty response" },
  { id: "stream-error", label: "Stream Interrupted", description: "Connection lost mid-stream" },
];

export function ErrorTestPanel({ onTriggerError }: ErrorTestPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Only show in development - use env.NODE_ENV for consistent server/client rendering
  if (env.NODE_ENV !== "development") {
    return null;
  }

  const triggerError = async (errorType: string) => {
    setIsLoading(true);
    setLastError(null);

    try {
      const response = await fetch("/api/v/test-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorType }),
      });

      // For stream errors, read the stream
      if (errorType === "stream-error") {
        const reader = response.body?.getReader();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            console.log("Stream chunk:", new TextDecoder().decode(value));
          }
        }
      }

      // Create an error object similar to what AI SDK would throw
      let error: unknown;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
      } else if (errorType === "no-content") {
        error = new Error("No content was generated");
        (error as any).name = "NoContentGeneratedError";
      }

      if (error) {
        // Use the error handler to process it
        const chatError = ChatErrorHandler.handleError(error, {
          showToast: true,
          onRetry: () => {
            console.log("Retry clicked");
          },
        });

        setLastError(`${chatError.type}: ${chatError.message}`);
        
        // Call the parent's error handler if provided
        if (onTriggerError) {
          onTriggerError(error);
        }
      }
    } catch (error) {
      console.error("Test error:", error);
      setLastError(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 transition-all hover:scale-110 flex items-center justify-center"
          aria-label="Open error test panel"
        >
          <Bug className="h-5 w-5" />
        </button>
      )}

      {/* Expanded Panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-2xl",
            "animate-in slide-in-from-bottom-2 slide-in-from-right-2 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Error Test Panel</h3>
              <span className="text-xs text-muted-foreground">(Dev)</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Error Scenarios */}
          <div className="max-h-96 overflow-y-auto p-2">
            <div className="space-y-1">
              {ERROR_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className={cn(
                    "w-full text-left p-2 rounded hover:bg-accent transition-colors",
                    "flex flex-col gap-0.5",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !isLoading && triggerError(scenario.id)}
                  disabled={isLoading}
                >
                  <div className="text-sm font-medium">{scenario.label}</div>
                  <div className="text-xs text-muted-foreground">{scenario.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Status Footer */}
          {lastError && (
            <div className="p-2 border-t">
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
                <span className="font-medium">Last:</span> {lastError}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}