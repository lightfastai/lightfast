import React from "react";
import { ZapIcon, CodeIcon, DatabaseIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";
import { AuthStatus } from "~/components/auth-status";

export default function HomePage() {
  return (
    <>
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="ml-auto">
          <AuthStatus />
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="mx-auto w-full max-w-3xl">
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="text-center space-y-4">
              <h1 className="text-foreground text-4xl font-bold">
                Welcome to Lightfast
              </h1>
              <p className="text-muted-foreground text-lg">
                Build AI agents with lightning speed
              </p>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-3 gap-8 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="rounded-lg border p-4">
                  <ZapIcon className="w-8 h-8 text-primary mx-auto" />
                </div>
                <span className="text-sm font-medium">Ready</span>
                <span className="text-xs text-muted-foreground">System Online</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="rounded-lg border p-4">
                  <CodeIcon className="w-8 h-8 text-primary mx-auto" />
                </div>
                <span className="text-sm font-medium">Connected</span>
                <span className="text-xs text-muted-foreground">API Active</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="rounded-lg border p-4">
                  <DatabaseIcon className="w-8 h-8 text-primary mx-auto" />
                </div>
                <span className="text-sm font-medium">Active</span>
                <span className="text-xs text-muted-foreground">Database Ready</span>
              </div>
            </div>

            {/* Action Section */}
            <div className="flex items-center justify-center gap-4">
              <Button size="lg">
                <ZapIcon className="mr-2 h-4 w-4" />
                Build Agent
              </Button>
              <Button variant="outline" size="lg">
                View Documentation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}