import React from "react";
import { ZapIcon, CodeIcon, DatabaseIcon } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { AuthStatus } from "~/components/auth-status";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-foreground text-4xl font-bold mb-2">
              Welcome to Lightfast
            </h1>
            <p className="text-muted-foreground text-lg">
              Build AI agents with lightning speed
            </p>
          </div>
          <AuthStatus />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-8 text-center my-12">
          <div className="flex flex-col items-center space-y-2">
            <ZapIcon className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground">Ready</span>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <CodeIcon className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground">Connected</span>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <DatabaseIcon className="w-8 h-8 text-primary" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
        </div>

        {/* Logo and Action */}
        <div className="flex items-center justify-between">
          <Icons.logoShort className="text-primary w-12 h-12" />
          <Button>
            <ZapIcon className="mr-2 h-4 w-4" />
            Build Agent
          </Button>
        </div>
      </div>
    </div>
  );
}