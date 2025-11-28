"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Alert, AlertTitle, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  orgSlug?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: "access_denied" | "not_found" | "unknown";
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
    // Determine error type from tRPC error message
    const message = error.message.toLowerCase();
    let errorType: State["errorType"] = "unknown";

    if (message.includes("access denied") || message.includes("forbidden")) {
      errorType = "access_denied";
    } else if (message.includes("not found")) {
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
      let message = this.state.error.message || "An unexpected error occurred while loading this page.";

      if (errorType === "access_denied") {
        title = "Access Denied";
        message = "You don't have permission to access this organization. Please select an organization you belong to.";
      } else if (errorType === "not_found") {
        title = "Organization Not Found";
        message = "This organization doesn't exist or has been removed.";
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-lg">
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
                  <Button onClick={this.reset} variant="outline" size="sm">
                    Retry
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/account/teams/new">
                    Select organization
                  </Link>
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
