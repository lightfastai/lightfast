"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  type McpConnection,
  McpConnectionDetailsSheet,
  McpConnectionsList,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/mcp/_components/mcp-connections-client";
import { useTRPC } from "~/trpc/react";

export function UserMcpConnectionsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: connections } = useSuspenseQuery(
    trpc.viewer.account.mcpConnections.list.queryOptions()
  );
  const [detailsConnection, setDetailsConnection] =
    useState<McpConnection | null>(null);
  const [revokeConnection, setRevokeConnection] =
    useState<McpConnection | null>(null);

  const revokeMutation = useMutation(
    trpc.viewer.account.mcpConnections.revoke.mutationOptions({
      meta: { errorTitle: "Failed to revoke MCP connection" },
      onSuccess: () => toast.success("MCP connection revoked"),
      onSettled: () =>
        void queryClient.invalidateQueries(
          trpc.viewer.account.mcpConnections.list.queryFilter()
        ),
    })
  );

  const handleConfirmRevoke = useCallback(() => {
    if (!revokeConnection) {
      return;
    }
    revokeMutation.mutate({ grantId: revokeConnection.grantId });
    setRevokeConnection(null);
  }, [revokeConnection, revokeMutation.mutate]);

  return (
    <>
      <McpConnectionsList
        connections={connections as McpConnection[]}
        isRevokingGrantId={
          revokeMutation.isPending ? revokeMutation.variables?.grantId : null
        }
        onDetails={setDetailsConnection}
        onRevoke={setRevokeConnection}
      />

      {detailsConnection ? (
        <McpConnectionDetailsSheet
          connection={detailsConnection}
          onOpenChange={(open) => {
            if (!open) {
              setDetailsConnection(null);
            }
          }}
        />
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setRevokeConnection(null);
          }
        }}
        open={!!revokeConnection}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke MCP connection?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeConnection?.clientName} will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRevoke}>
              Revoke connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
