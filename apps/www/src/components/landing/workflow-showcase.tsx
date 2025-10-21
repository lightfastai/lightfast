"use client";

import { useState, useEffect } from "react";
import { Check, Clock, Loader2 } from "lucide-react";

interface WorkflowStep {
  text: string;
  status: "pending" | "running" | "completed";
  tool: string;
}

export function WorkflowShowcase() {
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowStarted, setWorkflowStarted] = useState(false);

  const integrations = [
    { name: "GitHub", status: "connected", color: "text-purple-400" },
    { name: "Linear", status: "connected", color: "text-blue-400" },
    { name: "Vercel", status: "connected", color: "text-foreground" },
    { name: "Slack", status: "connected", color: "text-yellow-400" },
  ];

  const workflowSteps: WorkflowStep[] = [
    { text: "Creating feature branch", status: "pending", tool: "GitHub" },
    {
      text: "Generating PR from latest commits",
      status: "pending",
      tool: "GitHub",
    },
    {
      text: "Creating Linear ticket AUTH-123",
      status: "pending",
      tool: "Linear",
    },
    {
      text: "Linking PR to ticket",
      status: "pending",
      tool: "Linear + GitHub",
    },
    {
      text: "Triggering preview deployment",
      status: "pending",
      tool: "Vercel",
    },
    {
      text: "Notifying team in #engineering",
      status: "pending",
      tool: "Slack",
    },
  ];

  const [steps, setSteps] = useState<WorkflowStep[]>(workflowSteps);

  useEffect(() => {
    // Start workflow after 1 second
    const startTimeout = setTimeout(() => {
      setWorkflowStarted(true);
    }, 1000);

    return () => clearTimeout(startTimeout);
  }, []);

  useEffect(() => {
    if (!workflowStarted) return;

    if (currentStep < steps.length) {
      const timer = setTimeout(() => {
        setSteps((prev) =>
          prev.map((step, idx) => {
            if (idx === currentStep) {
              return { ...step, status: "running" };
            }
            return step;
          }),
        );

        // Complete step after short delay
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((step, idx) => {
              if (idx === currentStep) {
                return { ...step, status: "completed" };
              }
              return step;
            }),
          );
          setCurrentStep((prev) => prev + 1);
        }, 600);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [currentStep, workflowStarted, steps.length]);

  const isCompleted = currentStep >= steps.length;

  return (
    <div className="w-full h-full border border-border rounded-lg overflow-hidden flex">
      {/* Left Panel - Integrations */}
      <div className="w-1/4 border-r border-border bg-muted/30 p-6">
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Connected Tools
          </div>
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className={`text-sm font-medium ${integration.color}`}>
                  {integration.name}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-8 space-y-2">
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-2xl font-bold text-foreground">500+</div>
            <div className="text-xs text-muted-foreground">Integrations</div>
          </div>
        </div>
      </div>

      {/* Center Panel - Workflow Execution */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                Workflow Execution
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                deus orchestrate
              </div>
            </div>
            {isCompleted && (
              <div className="text-xs text-green-500 font-medium">
                Completed in 8.2s
              </div>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-auto p-6 space-y-6 font-mono text-sm">
          {/* User Input */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">You:</div>
            <div className="bg-muted/40 border border-border rounded-md p-4">
              <span className="text-foreground">
                "Ship the authentication feature"
              </span>
            </div>
          </div>

          {/* Deus Response */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Deus:</div>
            <div className="space-y-2">
              <div className="text-foreground/70 text-xs">
                Orchestrating workflow...
              </div>

              {/* Workflow Steps */}
              <div className="space-y-2 pt-2">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-xs transition-all duration-300"
                  >
                    <div className="flex-shrink-0">
                      {step.status === "completed" && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                      {step.status === "running" && (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      )}
                      {step.status === "pending" && (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span
                        className={
                          step.status === "completed"
                            ? "text-foreground"
                            : step.status === "running"
                              ? "text-blue-400"
                              : "text-muted-foreground"
                        }
                      >
                        {step.text}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({step.tool})
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {isCompleted && (
                <div className="pt-4 text-green-500 text-xs font-medium">
                  ✓ Workflow completed successfully
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Execution Details */}
      <div className="w-1/4 border-l border-border bg-muted/30 p-6">
        <div className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Workflow Details
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Steps</span>
                <span className="text-foreground font-medium">
                  {currentStep}/{steps.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tools Used</span>
                <span className="text-foreground font-medium">4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-retry</span>
                <span className="text-green-500 font-medium">Enabled</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Next Actions
            </div>
            <div className="space-y-2">
              <div className="text-xs text-foreground/70 p-2 bg-muted/50 rounded border border-border/50">
                Monitor PR checks
              </div>
              <div className="text-xs text-foreground/70 p-2 bg-muted/50 rounded border border-border/50">
                Review deployment
              </div>
              <div className="text-xs text-foreground/70 p-2 bg-muted/50 rounded border border-border/50">
                Update team status
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
