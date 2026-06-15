"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  IdentitySoulEmptyState,
  IdentitySoulSection,
} from "./identity-soul-section";

export function IdentitySoulCard({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.settings.identity.get.queryOptions()
  );

  if (!data.configured) {
    return <IdentitySoulEmptyState slug={slug} />;
  }

  return <IdentitySoulSection identity={data} />;
}
