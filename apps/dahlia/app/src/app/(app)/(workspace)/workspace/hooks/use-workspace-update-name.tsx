import { RouterInputs } from "@repo/api";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";

export type WorkspaceUpdateName = RouterInputs["workspace"]["updateName"];

export const useWorkspaceUpdateName = () => {
  const utils = api.useUtils();
  const { mutate } = api.workspace.updateName.useMutation({
    onSuccess: (input) => {
      utils.workspace.getAll.invalidate();
      utils.workspace.get.invalidate({ id: input.id });
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
