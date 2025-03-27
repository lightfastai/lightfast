import type { RouterInputs } from "@dahlia/trpc";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";

export type WorkspaceUpdateName =
  RouterInputs["tenant"]["workspace"]["updateName"];

export const useWorkspaceUpdateName = () => {
  const utils = api.useUtils();
  const { mutate } = api.tenant.workspace.updateName.useMutation({
    onSuccess: (input) => {
      utils.tenant.workspace.getAll.invalidate();
      utils.tenant.workspace.get.invalidate({ id: input.id });
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
  });
  return { mutate };
};
