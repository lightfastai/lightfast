import { HydrateClient } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { AskLightfast, AskLightfastSkeleton } from "~/components/ask-lightfast";

export default async function OrgHomePage() {
  return (
    <Suspense fallback={<AskLightfastSkeleton />}>
      <HydrateClient>
        <AskLightfast />
      </HydrateClient>
    </Suspense>
  );
}
