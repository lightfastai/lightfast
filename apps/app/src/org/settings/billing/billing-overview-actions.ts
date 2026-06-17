import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { useCallback } from "react";
import { orgBillingQueryKeys } from "./billing-queries";

export function useBillingOverviewRefresh() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: orgBillingQueryKeys.overview(auth.orgId),
      }),
    [auth.orgId, queryClient]
  );
}
