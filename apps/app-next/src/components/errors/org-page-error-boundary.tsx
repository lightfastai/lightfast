"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
  orgSlug?: string;
}

interface State {
  error: Error | null;
  errorType: "access_denied" | "not_found" | "unknown";
  hasError: boolean;
}

/**
 * Error boundary specifically for organization pages
 * Handles tRPC access errors (FORBIDDEN, NOT_FOUND) and provides
 * user-friendly error messages with navigation options
 */
export class OrgPageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorType: "unknown" };
  }

  static getDerivedStateFromError(error: Error): State {
    // Classify using tRPC's typed error code instead of message substring matching
    const data = (error as unknown as Record<string, unknown>).data as
      | Record<string, unknown>
      | undefined;
    const code = data?.code;

    let errorType: State["errorType"] = "unknown";
    if (code === "FORBIDDEN") {
      errorType = "access_denied";
    } else if (code === "NOT_FOUND") {
      errorType = "not_found";
    }

    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("OrgPageErrorBoundary caught error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorType: "unknown" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { errorType } = this.state;

      // Customize message based on error type
      let title = "Failed to load organization page";
      let message =
        this.state.error.message ||
        "An unexpected error occurred while loading this page.";

      if (errorType === "access_denied") {
        title = "Access Denied";
        message =
          "You don't have permission to access this organization. Please select an organization you belong to.";
      } else if (errorType === "not_found") {
        title = "Organization Not Found";
        message = "This organization doesn't exist or has been removed.";
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Alert className="max-w-lg" variant="destructive">
            {errorType === "access_denied" ? (
              <ShieldAlert className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p>{message}</p>
              <div className="flex gap-2">
                {errorType === "unknown" && (
                  <Button onClick={this.reset} size="sm" variant="outline">
                    Retry
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href="/account/teams/new">Select organization</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}
