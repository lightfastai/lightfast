"use client";
"use no memo";

import { useTRPC } from "@repo/console-trpc/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import { showErrorToast } from "~/lib/trpc-errors";

const providers = ["github", "vercel", "linear", "sentry"] as const;
type Provider = (typeof providers)[number];

const providerConfig: Record<
  Provider,
  {
    name: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    description: string;
  }
> = {
  github: {
    name: "GitHub",
    icon: IntegrationLogoIcons.github,
    description: "Connect your GitHub repositories",
  },
  vercel: {
    name: "Vercel",
    icon: IntegrationLogoIcons.vercel,
    description: "Connect your Vercel projects",
  },
  linear: {
    name: "Linear",
    icon: IntegrationLogoIcons.linear,
    description: "Connect your Linear workspace",
  },
  sentry: {
    name: "Sentry",
    icon: IntegrationLogoIcons.sentry,
    description: "Connect your Sentry projects",
  },
};

function SourceItem({ provider }: { provider: Provider }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const config = providerConfig[provider];
  const Icon = config.icon;

  const { data: integrations } = useSuspenseQuery({
    ...trpc.connections.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const connection = integrations.find(
    (i) => i.sourceType === provider && i.isActive
  );

  const { handleConnect } = useOAuthPopup({
    provider,
    queryKeysToInvalidate: [trpc.connections.list.queryOptions().queryKey],
  });

  const disconnectMutation = useMutation(
    trpc.connections.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(`${config.name} disconnected`);
        void queryClient.invalidateQueries({
          queryKey: trpc.connections.list.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        showErrorToast(error, `Failed to disconnect ${config.name}`);
      },
    })
  );

  const handleDisconnect = () => {
    if (
      connection &&
      window.confirm(
        `Disconnect ${config.name}? This will remove access to all resources connected through this integration.`
      )
    ) {
      disconnectMutation.mutate({ integrationId: connection.id });
    }
  };

  return (
    <AccordionItem value={provider}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="font-medium">{config.name}</span>
          {connection ? (
            <Badge className="text-xs" variant="secondary">
              Connected
            </Badge>
          ) : (
            <Badge className="text-muted-foreground text-xs" variant="outline">
              Not connected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {connection ? (
          <div className="space-y-3 pt-2">
            <p className="text-muted-foreground text-sm">
              Connected{" "}
              {formatDistanceToNow(new Date(connection.connectedAt), {
                addSuffix: true,
              })}
              {connection.lastSyncAt && (
                <>
                  {" · "}Last used{" "}
                  {formatDistanceToNow(new Date(connection.lastSyncAt), {
                    addSuffix: true,
                  })}
                </>
              )}
            </p>
            <Button
              disabled={disconnectMutation.isPending}
              onClick={handleDisconnect}
              size="sm"
              variant="outline"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              {config.description}
            </p>
            <Button onClick={handleConnect} variant="outline">
              <Icon className="mr-2 h-4 w-4" />
              Connect {config.name}
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function SourcesList() {
  return (
    <Accordion className="w-full rounded-lg border" type="multiple">
      {providers.map((provider) => (
        <SourceItem key={provider} provider={provider} />
      ))}
    </Accordion>
  );
}
