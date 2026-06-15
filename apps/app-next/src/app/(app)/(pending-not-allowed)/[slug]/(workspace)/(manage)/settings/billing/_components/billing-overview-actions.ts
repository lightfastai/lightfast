"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "~/trpc/react";

export function useBillingOverviewRefresh() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.invalidateQueries(
        trpc.org.settings.orgBilling.overview.queryFilter()
      ),
    [queryClient, trpc]
  );
}
