"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useTRPC } from "../react";

/**
 * Returns the active organization based on the URL slug.
 * Reads from the prefetched `listUserOrganizations` cache — no additional network request.
 * Must be used within a `[slug]` route segment.
 */
export function useActiveOrg() {
  const params = useParams<{ slug: string }>();
  const trpc = useTRPC();

  const { data: organizations } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  return organizations.find((o) => o.slug === params.slug) ?? null;
}
