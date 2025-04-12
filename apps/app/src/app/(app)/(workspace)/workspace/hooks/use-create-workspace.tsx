import { useRouter } from "next/navigation";

import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/client/react";

export const useCreateWorkspace = () => {
  const router = useRouter();
  const utils = api.useUtils();
  const { mutateAsync } = api.tenant.workspace.create.useMutation({
    onSuccess: async (data) => {
      await utils.tenant.workspace.getAll.invalidate();
      router.push(`/workspace/${data.id}`);
      toast({
        title: "Workspace created",
        description: "You can now start creating nodes",
      });
    },
    onError: (error) => {
      console.error(error);
      if (error.data?.code === "UNAUTHORIZED") {
        toast({
          title: "Error",
          description: "You are not authorized to create a workspace",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
        });
      }
    },
  });
  return { mutateAsync };
};
