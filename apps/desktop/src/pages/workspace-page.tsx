import { RootLayout } from "@/components/root-layout";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Input } from "@repo/ui/components/ui/input";

export default function WorkspacePage() {
  const { workspaceId } = useParams({ from: "/workspace/$workspaceId" });
  const { data: workspace } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  return (
    <RootLayout>
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="flex items-center justify-center font-serif text-4xl text-gray-100">
            <Sparkles className="mr-3 size-5 text-orange-500" />
            {workspace?.name}
          </h1>
        </div>

        <div className="mb-6 flex w-full max-w-xl flex-col gap-2">
          <Input />
        </div>
      </div>
    </RootLayout>
  );
}
