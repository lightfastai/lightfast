import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@repo/ui/hooks/use-toast";

import type { RouterInputs } from "~/trpc/server/index";
import { useTRPC } from "~/trpc/client/react";

export type WorkspaceUpdateName =
  RouterInputs["tenant"]["workspace"]["updateName"];

export const useWorkspaceUpdateName = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate } = useMutation(
    trpc.tenant.workspace.updateName.mutationOptions({
      onSuccess: async (input) => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.tenant.workspace.getAll.queryFilter(),
          ),
          queryClient.invalidateQueries(
            trpc.tenant.workspace.get.queryFilter({ id: input.id }),
          ),
        ]);
        toast({
          title: "Workspace name updated",
        });
      },
      onError: (error) => {
        toast({
          title: "Failed to update workspace name",
          description: error.message,
        });
      },
    }),
  );
  return { mutate };
};
