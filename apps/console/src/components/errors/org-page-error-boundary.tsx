"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Alert, AlertTitle, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  orgSlug?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for organization pages
 * Provides navigation back to org selection if error occurs
 */
export class OrgPageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("OrgPageErrorBoundary caught error:", error);
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
            <AlertTitle>Failed to load organization page</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p>
                {this.state.error.message || "An unexpected error occurred while loading this page."}
              </p>
              <div className="flex gap-2">
                <Button onClick={this.reset} variant="outline" size="sm">
                  Retry
                </Button>
                {this.props.orgSlug && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/org/${this.props.orgSlug}`}>
                      Go to org home
                    </Link>
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}
