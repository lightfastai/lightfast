"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect } from "react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { ConnectFormProvider } from "./connect-form-provider";
import { useConnectParams } from "./use-connect-params";
import { ProviderSelector } from "./provider-selector";
import { GitHubConnector } from "./github-connector";
import { VercelConnector } from "./vercel-connector";
import { ResourcePicker } from "./resource-picker";
import { ConnectButton } from "./connect-button";

interface ConnectInitializerProps {
  initialProvider: "github" | "vercel" | "linear" | "sentry";
  initialConnected: boolean;
  clerkOrgSlug: string;
  workspaceName: string;
}

export function ConnectInitializer({
  initialProvider,
  initialConnected,
  clerkOrgSlug,
  workspaceName,
}: ConnectInitializerProps) {
  const { provider, clearConnected } = useConnectParams();

  // Clear connected param after reading
  useEffect(() => {
    if (initialConnected) {
      void clearConnected();
    }
  }, [initialConnected, clearConnected]);

  return (
    <ConnectFormProvider
      initialProvider={initialProvider}
      clerkOrgSlug={clerkOrgSlug}
      workspaceName={workspaceName}
    >
      <div className="space-y-8">
        {/* Section 1: Select Provider */}
        <Section number={1} title="Select Provider">
          <ProviderSelector />
        </Section>

        {/* Section 2: Connect Account */}
        <Section number={2} title="Connect Account">
          <Suspense fallback={<ConnectorSkeleton />}>
            {provider === "github" && <GitHubConnector autoOpen={initialConnected} />}
            {provider === "vercel" && <VercelConnector autoOpen={initialConnected} />}
            {provider === "linear" && (
              <div className="rounded-lg border border-border p-6 text-center">
                <p className="text-muted-foreground">Linear connector coming soon</p>
              </div>
            )}
            {provider === "sentry" && (
              <div className="rounded-lg border border-border p-6 text-center">
                <p className="text-muted-foreground">Sentry connector coming soon</p>
              </div>
            )}
          </Suspense>
        </Section>

        {/* Section 3: Select Resources */}
        <Section number={3} title="Select Resources">
          <ResourcePicker />
        </Section>
      </div>

      {/* Footer with action button */}
      <ConnectButton />
    </ConnectFormProvider>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
        {number}
      </div>
      <div className="flex-1 space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ConnectorSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
