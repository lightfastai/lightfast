import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type Session = RouterOutputs["chat"]["session"]["list"][number];

export function usePinSession() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  return useMutation(
    trpc.chat.session.setPinned.mutationOptions({
      onMutate: async ({ sessionId, pinned }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries(trpc.chat.session.list.infiniteQueryOptions());
        
        // Snapshot the previous value
        const previousData = queryClient.getQueryData(
          trpc.chat.session.list.infiniteQueryOptions().queryKey
        );
        
        // Optimistically update the cache
        queryClient.setQueryData(
          trpc.chat.session.list.infiniteQueryOptions().queryKey,
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page: Session[]) =>
                page.map((session) =>
                  session.id === sessionId
                    ? { ...session, pinned }
                    : session
                )
              ),
            };
          }
        );
        
        // Return a context object with the snapshotted value
        return { previousData };
      },
      onError: (err, variables, context) => {
        console.error("Failed to update pin status:", err);
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousData) {
          queryClient.setQueryData(
            trpc.chat.session.list.infiniteQueryOptions().queryKey,
            context.previousData
          );
        }
      },
      onSettled: () => {
        // Always refetch after error or success (but without suspending)
        queryClient.invalidateQueries({
          ...trpc.chat.session.list.infiniteQueryOptions(),
          refetchType: 'none', // Don't trigger suspense
        });
      },
    })
  );
}