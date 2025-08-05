"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "~/lib/api-client";

export default function PlaygroundPage() {
  const { userId, isLoaded } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>("");

  const createSession = async () => {
    if (!userId) {
      toast.error("Please sign in to use the playground");
      return;
    }

    setIsCreatingSession(true);
    try {
      const data = await apiClient.createSession("browser");
      setSessionId(data.sessionId);
      toast.success("Session created successfully");
    } catch (error) {
      toast.error("Failed to create session");
      console.error(error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const runAgent = async () => {
    if (!sessionId) {
      toast.error("Please create a session first");
      return;
    }

    setIsRunning(true);
    setOutput("Running agent task...\n");
    
    try {
      const data = await apiClient.runTask(
        sessionId,
        "Navigate to https://example.com and extract the page title"
      );
      
      toast.success("Agent task completed");
      setOutput(prev => prev + `Task completed successfully!\nResult: ${JSON.stringify(data.result, null, 2)}`);
    } catch (error) {
      toast.error("Failed to run agent");
      setOutput(prev => prev + `Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please sign in to access the Lightfast Playground
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Lightfast Playground</h1>
        <p className="text-muted-foreground mt-2">Test AI agents with browser automation</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!sessionId ? (
              <Button
                onClick={createSession}
                disabled={isCreatingSession}
                className="w-full"
              >
                {isCreatingSession ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Session...
                  </>
                ) : (
                  "Create New Session"
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Session ID: {sessionId}
                </p>
                <Button
                  onClick={runAgent}
                  disabled={isRunning}
                  className="w-full"
                  variant={isRunning ? "secondary" : "default"}
                >
                  {isRunning ? (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Browser Agent
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-auto rounded-md border bg-muted/10 p-4">
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {output || "Agent output will appear here..."}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}