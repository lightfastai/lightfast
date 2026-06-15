"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTRPC } from "~/trpc/react";

const RESERVED_FIRST_SEGMENTS = new Set([
  "account",
  "api",
  "new",
  "sign-in",
  "sign-up",
]);

export interface ActiveOrg {
  id: string;
  initials: string;
  name: string;
  slug: string;
}

export function useActiveOrg(): ActiveOrg | null {
  const trpc = useTRPC();
  const pathname = usePathname();
  const { data: organizations } = useQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment || RESERVED_FIRST_SEGMENTS.has(firstSegment)) {
    return null;
  }

  const org = organizations?.find(
    (candidate) => candidate.slug === firstSegment
  );
  if (!org) {
    return null;
  }

  return {
    id: org.id,
    initials: org.initials,
    name: org.name,
    slug: org.slug ?? firstSegment,
  };
}
