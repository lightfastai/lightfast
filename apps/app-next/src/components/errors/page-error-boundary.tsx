"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
  fallbackDescription?: string;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
  hasError: boolean;
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
          <Alert className="max-w-lg" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {this.props.fallbackTitle ?? "Failed to load page"}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {this.props.fallbackDescription ??
                (this.state.error.message || "An unexpected error occurred")}
            </AlertDescription>
            <Button className="mt-4" onClick={this.reset} variant="outline">
              Retry
            </Button>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}
