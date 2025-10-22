"use client";

import { useState, useEffect } from "react";
import { Check, Clock, Loader2, GitPullRequest, Circle } from "lucide-react";

interface WorkflowStep {
  text: string;
  status: "pending" | "running" | "completed";
  tool: string;
}

interface Task {
  id: string;
  text: string;
  workflow: WorkflowStep[];
}

interface Workflow {
  number: number;
  title: string;
  branch: string;
  description: string;
  changes: string[];
  tasksCompleted?: Task[];
  tasksRemaining?: Task[];
  testCoverage?: string;
  relatedIssues?: string[];
  deploymentStatus?: string;
  databaseBranch?: string;
}

export function WorkflowShowcase() {
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(127);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);

  const integrations = [
    { name: "GitHub", status: "connected", color: "text-purple-400" },
    { name: "Linear", status: "connected", color: "text-blue-400" },
    { name: "Vercel", status: "connected", color: "text-foreground" },
    { name: "Slack", status: "connected", color: "text-yellow-400" },
  ];

  const workflows: Workflow[] = [
    {
      number: 127,
      title: "feat: Add Clerk authentication",
      branch: "feat/clerk-auth",
      description:
        "Integrates Clerk authentication with support for GitHub, Google, and email providers. This PR includes Clerk session management, organization-based access control, secure middleware configuration, webhook handlers for user events, and comprehensive security measures including rate limiting and CSRF protection.",
      changes: [
        "Installed and configured Clerk SDK",
        "Set up Clerk application with OAuth providers (GitHub, Google)",
        "Implemented Clerk middleware for route protection",
        "Created organization-based access control",
        "Added Clerk webhooks for user lifecycle events",
        "Configured session management with Clerk",
        "Built protected API routes using Clerk session validation",
        "Added CSRF protection middleware",
        "Created rate limiting for authentication endpoints",
        "Implemented user profile synchronization with database",
        "Added Clerk UI components for sign-in/sign-up flows",
        "Created comprehensive test suite (87% coverage)",
        "Configured Clerk environment variables across environments",
        "Built user management dashboard with Clerk integration",
      ],
      tasksCompleted: [
        {
          id: "task-1",
          text: "Set up authentication database schema with user roles",
          workflow: [
            {
              text: "Designing schema for users table",
              status: "pending",
              tool: "Claude Code",
            },
            {
              text: "Adding role and permission columns",
              status: "pending",
              tool: "Planetscale",
            },
            {
              text: "Creating migration files",
              status: "pending",
              tool: "Drizzle ORM",
            },
            {
              text: "Running migrations on dev database",
              status: "pending",
              tool: "Planetscale",
            },
            {
              text: "Committing schema changes",
              status: "pending",
              tool: "GitHub",
            },
          ],
        },
        {
          id: "task-2",
          text: "Configure Clerk with OAuth providers",
          workflow: [
            {
              text: "Creating Clerk application",
              status: "pending",
              tool: "Clerk Dashboard",
            },
            {
              text: "Enabling GitHub and Google OAuth",
              status: "pending",
              tool: "Clerk Dashboard",
            },
            {
              text: "Installing @clerk/nextjs package",
              status: "pending",
              tool: "npm",
            },
            {
              text: "Configuring Clerk middleware",
              status: "pending",
              tool: "Claude Code",
            },
            {
              text: "Adding Clerk provider to app layout",
              status: "pending",
              tool: "Next.js",
            },
            {
              text: "Testing sign-in flows",
              status: "pending",
              tool: "Browser",
            },
            {
              text: "Committing Clerk integration",
              status: "pending",
              tool: "GitHub",
            },
          ],
        },
        {
          id: "task-3",
          text: "Set up Clerk webhooks for user sync",
          workflow: [
            {
              text: "Creating webhook endpoint",
              status: "pending",
              tool: "Next.js",
            },
            {
              text: "Configuring webhook in Clerk dashboard",
              status: "pending",
              tool: "Clerk Dashboard",
            },
            {
              text: "Implementing user.created handler",
              status: "pending",
              tool: "Claude Code",
            },
            {
              text: "Adding user profile sync to database",
              status: "pending",
              tool: "Codex",
            },
            {
              text: "Testing webhook delivery",
              status: "pending",
              tool: "Svix CLI",
            },
          ],
        },
        {
          id: "task-4",
          text: "Implement protected routes with Clerk middleware",
          workflow: [
            {
              text: "Configuring middleware.ts",
              status: "pending",
              tool: "Claude Code",
            },
            {
              text: "Defining public and protected routes",
              status: "pending",
              tool: "Codex",
            },
            {
              text: "Adding auth() helper to API routes",
              status: "pending",
              tool: "Next.js",
            },
            {
              text: "Creating organization permission checks",
              status: "pending",
              tool: "Claude Code",
            },
            {
              text: "Testing route protection",
              status: "pending",
              tool: "Tests",
            },
          ],
        },
        {
          id: "task-5",
          text: "Write tests for Clerk integration (87% coverage)",
          workflow: [
            {
              text: "Setting up @clerk/testing",
              status: "pending",
              tool: "Vitest",
            },
            {
              text: "Mocking Clerk session helpers",
              status: "pending",
              tool: "Tests",
            },
            {
              text: "Testing protected route middleware",
              status: "pending",
              tool: "Tests",
            },
            {
              text: "Validating webhook handlers",
              status: "pending",
              tool: "Tests",
            },
            {
              text: "Generating coverage report",
              status: "pending",
              tool: "Vitest",
            },
            {
              text: "Committing test suite",
              status: "pending",
              tool: "GitHub",
            },
          ],
        },
      ],
      tasksRemaining: [
        {
          id: "task-6",
          text: "Add 2FA/MFA support with TOTP",
          workflow: [
            { text: "Research TOTP libraries", status: "pending", tool: "Web" },
            {
              text: "Install authenticator library",
              status: "pending",
              tool: "npm",
            },
            {
              text: "Create QR code generation",
              status: "pending",
              tool: "Claude Code",
            },
            { text: "Build 2FA setup UI", status: "pending", tool: "React" },
            {
              text: "Add backup codes system",
              status: "pending",
              tool: "Codex",
            },
          ],
        },
        {
          id: "task-7",
          text: "Write E2E tests for complete auth flows",
          workflow: [
            {
              text: "Setting up Playwright",
              status: "pending",
              tool: "Playwright",
            },
            {
              text: "Creating test fixtures",
              status: "pending",
              tool: "Tests",
            },
            {
              text: "Writing login flow tests",
              status: "pending",
              tool: "Playwright",
            },
            {
              text: "Testing OAuth redirects",
              status: "pending",
              tool: "Playwright",
            },
            {
              text: "Running CI/CD integration",
              status: "pending",
              tool: "GitHub Actions",
            },
          ],
        },
        {
          id: "task-8",
          text: "Perform security audit and penetration testing",
          workflow: [
            {
              text: "Running OWASP ZAP scan",
              status: "pending",
              tool: "Security Tools",
            },
            {
              text: "Testing for SQL injection",
              status: "pending",
              tool: "Security Tools",
            },
            {
              text: "Checking CSRF protection",
              status: "pending",
              tool: "Security Tools",
            },
            {
              text: "Documenting vulnerabilities",
              status: "pending",
              tool: "Linear",
            },
            {
              text: "Creating remediation tickets",
              status: "pending",
              tool: "Linear",
            },
          ],
        },
      ],
      testCoverage: "87%",
      relatedIssues: ["AUTH-123", "SEC-456", "FEAT-789"],
      deploymentStatus: "Preview deployed to auth-preview.vercel.app",
      databaseBranch: "feat/clerk-auth",
    },
    {
      number: 126,
      title: "fix: Resolve database connection pooling issues",
      branch: "fix/db-pool-exhaustion",
      description:
        "Fixes connection pool exhaustion issues by implementing proper connection lifecycle management and adding connection pool monitoring.",
      changes: [
        "Updated database client configuration",
        "Added connection pool size limits",
        "Implemented connection timeout handling",
        "Added pool metrics logging",
      ],
    },
    {
      number: 125,
      title: "feat: Add real-time notifications system",
      branch: "feat/realtime-notifications",
      description:
        "Implements WebSocket-based real-time notifications for user actions, system events, and collaborative features.",
      changes: [
        "Set up WebSocket server infrastructure",
        "Created notification event system",
        "Added user notification preferences",
        "Implemented notification UI components",
      ],
    },
    {
      number: 124,
      title: "refactor: Migrate API routes to App Router",
      branch: "refactor/app-router-migration",
      description:
        "Migrates legacy API routes from Pages Router to Next.js 15 App Router with improved type safety and middleware support.",
      changes: [
        "Converted API routes to route handlers",
        "Updated middleware for App Router",
        "Improved error handling patterns",
        "Added request validation schemas",
      ],
    },
  ];

  const defaultWorkflowSteps: WorkflowStep[] = [
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

  const [steps, setSteps] = useState<WorkflowStep[]>(defaultWorkflowSteps);

  // Switch workflow when task is selected
  useEffect(() => {
    if (selectedTask) {
      const currentWorkflow = workflows.find(
        (wf) => wf.number === selectedWorkflow,
      )!;

      // Check if task is in completed list
      const isCompleted =
        currentWorkflow.tasksCompleted?.some((t) => t.id === selectedTask) ??
        false;

      const allTasks = [
        ...(currentWorkflow.tasksCompleted || []),
        ...(currentWorkflow.tasksRemaining || []),
      ];
      const task = allTasks.find((t) => t.id === selectedTask);

      if (task) {
        // If task is completed, show all steps as completed
        if (isCompleted) {
          setSteps(
            task.workflow.map((step) => ({ ...step, status: "completed" })),
          );
          setCurrentStep(task.workflow.length);
          setIsTaskCompleted(true);
          setWorkflowStarted(false);
        } else {
          // If task is remaining, show steps as pending
          setSteps(
            task.workflow.map((step) => ({ ...step, status: "pending" })),
          );
          setCurrentStep(0);
          setIsTaskCompleted(false);
          setWorkflowStarted(false);
        }
      }
    } else {
      setSteps(defaultWorkflowSteps);
      setCurrentStep(0);
      setIsTaskCompleted(false);
      setWorkflowStarted(false);
    }
  }, [selectedTask, selectedWorkflow]);

  useEffect(() => {
    // Only auto-start workflow for default PR workflow (not tasks)
    // For remaining tasks, user needs to click button to start
    if (!selectedTask && !isTaskCompleted) {
      const startTimeout = setTimeout(() => {
        setWorkflowStarted(true);
      }, 1000);

      return () => clearTimeout(startTimeout);
    }
  }, [steps, selectedTask, isTaskCompleted]);

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
  const currentWorkflow = workflows.find(
    (wf) => wf.number === selectedWorkflow,
  )!;

  const handleStartOrchestration = () => {
    setWorkflowStarted(true);
  };

  return (
    <div className="w-full h-full border-t overflow-hidden flex">
      {/* Left Sidebar - Active Workflows */}
      <div className="w-72 border-r border-border flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Workflows
            </span>
          </div>
        </div>

        {/* Workflow List */}
        <div className="flex-1 overflow-auto">
          <div className="divide-y divide-border">
            {workflows.map((wf) => (
              <button
                key={wf.number}
                onClick={() => {
                  setSelectedWorkflow(wf.number);
                  setSelectedTask(null);
                }}
                className={`w-full px-4 py-3 text-left cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedWorkflow === wf.number ? "bg-muted/30" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <GitPullRequest className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground mb-1 truncate">
                      {wf.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                      <span className="flex-shrink-0">#{wf.number}</span>
                      <span className="flex-shrink-0">•</span>
                      <span className="font-mono truncate min-w-0 block">
                        {wf.branch}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Workflow Description */}
      <div className="flex-1 flex flex-col border-r border-border">
        <div className="flex-1 overflow-auto p-6">
          <div className="prose prose-sm max-w-none">
            <div className="space-y-6 text-sm">
              {/* Description */}
              <div>
                <h3 className="text-foreground font-medium mb-2">
                  Description
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  {currentWorkflow.description}
                </p>
              </div>

              {/* Related Issues */}
              {currentWorkflow.relatedIssues && (
                <div>
                  <h3 className="text-foreground font-medium mb-2">
                    Found Related Issues
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {currentWorkflow.relatedIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 bg-muted/30 border border-border rounded flex items-center gap-2"
                      >
                        <span className="text-xs font-medium text-foreground">
                          Linear
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {issue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Completed */}
              {currentWorkflow.tasksCompleted && (
                <div>
                  <h3 className="text-foreground font-medium mb-2 flex items-center gap-2">
                    Tasks Completed ({currentWorkflow.tasksCompleted.length})
                  </h3>
                  <ul className="text-foreground/70 space-y-1.5">
                    {currentWorkflow.tasksCompleted.map((task) => (
                      <li key={task.id} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        <button
                          onClick={() => setSelectedTask(task.id)}
                          className={`text-left cursor-pointer hover:text-foreground transition-colors ${
                            selectedTask === task.id
                              ? "text-foreground font-medium"
                              : ""
                          }`}
                        >
                          {task.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tasks Remaining */}
              {currentWorkflow.tasksRemaining && (
                <div>
                  <h3 className="text-foreground font-medium mb-2 flex items-center gap-2">
                    Tasks Remaining ({currentWorkflow.tasksRemaining.length})
                  </h3>
                  <ul className="text-foreground/70 space-y-1.5">
                    {currentWorkflow.tasksRemaining.map((task) => (
                      <li key={task.id} className="flex items-start gap-2">
                        <Circle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <button
                          onClick={() => setSelectedTask(task.id)}
                          className={`text-left cursor-pointer hover:text-foreground transition-colors ${
                            selectedTask === task.id
                              ? "text-foreground font-medium"
                              : ""
                          }`}
                        >
                          {task.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Test Coverage, Database Branch & Deployment */}
              <div className="flex flex-col gap-4">
                {currentWorkflow.testCoverage && (
                  <div>
                    <h3 className="text-foreground font-medium mb-2">
                      Test Coverage
                    </h3>
                    <div className="px-3 py-2 bg-muted/30 border border-border rounded">
                      <span className="text-foreground font-medium">
                        {currentWorkflow.testCoverage}
                      </span>
                    </div>
                  </div>
                )}
                {currentWorkflow.databaseBranch && (
                  <div>
                    <h3 className="text-foreground font-medium mb-2">
                      Database Branch
                    </h3>
                    <div className="px-3 py-2 bg-muted/30 border border-border rounded flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-foreground flex-shrink-0">
                        Planetscale
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        •
                      </span>
                      <span className="text-foreground text-xs font-mono truncate min-w-0 block">
                        {currentWorkflow.databaseBranch}
                      </span>
                    </div>
                  </div>
                )}
                {currentWorkflow.deploymentStatus && (
                  <div>
                    <h3 className="text-foreground font-medium mb-2">
                      Deployment
                    </h3>
                    <div className="px-3 py-2 bg-muted/30 border border-border rounded">
                      <span className="text-foreground text-xs">
                        {currentWorkflow.deploymentStatus}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Technical Changes */}
              <div>
                <h3 className="text-foreground font-medium mb-2">
                  Technical Changes
                </h3>
                <ul className="text-foreground/70 space-y-1 list-disc list-inside">
                  {currentWorkflow.changes.map((change, idx) => (
                    <li key={idx}>{change}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Content - Deus Conversation */}
      <div className="w-96 flex flex-col">
        <div className="flex-1 overflow-auto p-6 space-y-4 text-sm">
          {/* User Message */}
          <div className="flex justify-end">
            <div className="bg-background/30 text-foreground rounded-2xl px-4 py-3 font-sans text-sm max-w-[85%]">
              {selectedTask
                ? [
                    ...(currentWorkflow.tasksCompleted || []),
                    ...(currentWorkflow.tasksRemaining || []),
                  ].find((t) => t.id === selectedTask)?.text
                : currentWorkflow.title.replace(
                    /^(feat|fix|refactor|chore):\s*/i,
                    "",
                  )}
            </div>
          </div>

          {/* Deus Response */}
          <div className="space-y-3">
            <div className="font-sans text-sm text-foreground/90 leading-relaxed">
              I'll help you with this. Let me orchestrate the necessary steps
              and coordinate with the required tools.
            </div>

            {/* Start Button for Remaining Tasks */}
            {selectedTask && !isTaskCompleted && !workflowStarted && (
              <button
                onClick={handleStartOrchestration}
                className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Press here to continue orchestrating
              </button>
            )}

            {/* Tool Calls */}
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg transition-all duration-300 hover:bg-border/30"
                >
                  <div className="py-3 px-4">
                    <div className="flex items-center gap-3">
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
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-muted-foreground lowercase font-sans">
                          {step.tool}: {step.text}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Final Response */}
            {isCompleted && (
              <div className="font-sans mt-3">
                <span className="text-foreground/90 text-sm leading-relaxed">
                  ✓ All steps completed successfully. The workflow has been
                  orchestrated and executed.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
