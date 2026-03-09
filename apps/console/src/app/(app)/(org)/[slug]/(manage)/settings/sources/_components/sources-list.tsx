"use client";
"use no memo";

import {
  PROVIDER_DISPLAY,
  PROVIDER_SLUGS,
} from "@repo/console-providers/display";
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
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import { ProviderIcon } from "~/lib/provider-icon";
import { showErrorToast } from "~/lib/trpc-errors";

type Provider = (typeof PROVIDER_SLUGS)[number];

function SourceItem({ provider }: { provider: Provider }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const display = PROVIDER_DISPLAY[provider];

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
        toast.success(`${display.displayName} disconnected`);
        void queryClient.invalidateQueries({
          queryKey: trpc.connections.list.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        showErrorToast(error, `Failed to disconnect ${display.displayName}`);
      },
    })
  );

  const handleDisconnect = () => {
    if (
      connection &&
      window.confirm(
        `Disconnect ${display.displayName}? This will remove access to all resources connected through this integration.`
      )
    ) {
      disconnectMutation.mutate({ integrationId: connection.id });
    }
  };

  return (
    <AccordionItem value={provider}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <ProviderIcon className="h-5 w-5 shrink-0" icon={display.icon} />
          <span className="font-medium">{display.displayName}</span>
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
              {display.description}
            </p>
            <Button onClick={handleConnect} variant="outline">
              <ProviderIcon className="mr-2 h-4 w-4" icon={display.icon} />
              Connect {display.displayName}
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
      {PROVIDER_SLUGS.map((provider) => (
        <SourceItem key={provider} provider={provider} />
      ))}
    </Accordion>
  );
}
