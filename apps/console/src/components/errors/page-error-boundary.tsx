"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Alert, AlertTitle, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary for page-level errors
 * Displays a user-friendly error message with retry option
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PageErrorBoundary caught error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {this.props.fallbackTitle ?? "Failed to load page"}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {this.props.fallbackDescription ?? (this.state.error.message || "An unexpected error occurred")}
            </AlertDescription>
            <Button onClick={this.reset} variant="outline" className="mt-4">
              Retry
            </Button>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}
