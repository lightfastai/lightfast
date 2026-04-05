"use client";

import { useActiveOrg } from "@repo/app-trpc/hooks";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AnswerInterface } from "./answer-interface";

export function AskLightfast() {
  const activeOrg = useActiveOrg();
  const clerkOrgId = activeOrg?.id ?? "";

  return <AnswerInterface clerkOrgId={clerkOrgId} />;
}

export function AskLightfastSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[72px] w-full max-w-3xl" />
    </div>
  );
}
