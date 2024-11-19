import { useRouter } from "next/navigation";

import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";

export const useCreateWorkspace = () => {
  const router = useRouter();
  const { mutateAsync: createWorkspace } = api.workspace.create.useMutation({
    onSuccess: (data) => {
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
  return { createWorkspace };
};
