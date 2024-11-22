import { useRouter } from "next/navigation";

import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";

export const useCreateWorkspace = () => {
  const router = useRouter();
  const utils = api.useUtils();
  const { mutateAsync } = api.workspace.create.useMutation({
    onSuccess: (data) => {
      utils.workspace.getAll.invalidate();
      toast({
        title: "Workspace created",
        description: "You can now start creating nodes",
      });
      router.push(`/workspace/${data.id}`);
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
