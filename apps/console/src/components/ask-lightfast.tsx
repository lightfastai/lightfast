"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AnswerInterface } from "./answer-interface";

interface AskLightfastProps {
  orgSlug: string;
  workspaceName: string;
}

export function AskLightfast({ orgSlug, workspaceName }: AskLightfastProps) {
  const trpc = useTRPC();

  const { data: store } = useSuspenseQuery({
    ...trpc.workspace.store.get.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // store is guaranteed by useSuspenseQuery
  if (!store) {
    throw new Error("Store not found");
  }

  return <AnswerInterface workspaceId={store.id} />;
}

export function AskLightfastSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[72px] w-full max-w-3xl" />
    </div>
  );
}
