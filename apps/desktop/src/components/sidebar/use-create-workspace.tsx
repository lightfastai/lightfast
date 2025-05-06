import { trpc } from "@/trpc";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";
import { useSidebar } from "@repo/ui/components/ui/sidebar";

export const useCreateWorkspaceMutation = () => {
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  return useMutation(
    trpc.tenant.workspace.create.mutationOptions({
      async onSuccess(data) {
        await queryClient.invalidateQueries(
          trpc.tenant.workspace.getAll.queryFilter(),
        );
        // Navigate to the new workspace with correct route param format
        navigate({
          to: "/workspace/$workspaceId",
          params: { workspaceId: data.id },
          // Force TanStack Router to clear any potential cached matches
          replace: true,
          // Make sure the router does fresh matching
          startTransition: true,
        });
        // Close the sidebar by dispatching the toggle event
        toggleSidebar();
      },
    }),
  );
};
