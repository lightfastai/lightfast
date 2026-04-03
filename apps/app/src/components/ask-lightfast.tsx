"use client";

import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useOrganization } from "@vendor/clerk/client";
import { AnswerInterface } from "./answer-interface";

export function AskLightfast() {
  const { organization } = useOrganization();
  const clerkOrgId = organization?.id ?? "";

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
