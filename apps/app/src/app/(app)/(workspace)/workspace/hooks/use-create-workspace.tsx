import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@repo/ui/hooks/use-toast";

import { useTRPC } from "~/trpc/client/react";

export const useCreateWorkspace = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation(
    trpc.tenant.workspace.create.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries(
          trpc.tenant.workspace.getAll.queryFilter(),
        );
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
    }),
  );
  return { mutateAsync };
};
