import {
  createAccountUsername,
  getAccountProfile,
  updateAccountName,
} from "@api/app/tanstack/account";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

export const accountQueryKeys = {
  all: ["account"] as const,
  profile: () => ["account", "profile"] as const,
};

export function accountProfileQueryOptions(input?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: (input?.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => getAccountProfile(),
    queryKey: accountQueryKeys.profile(),
    staleTime: input?.staleTime ?? 5 * 60 * 1000,
  });
}

export function updateAccountNameMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to update display name" },
    mutationFn: (data: { displayName: string }) => updateAccountName({ data }),
  });
}

export function createAccountUsernameMutationOptions() {
  return mutationOptions({
    meta: { suppressErrorToast: true },
    mutationFn: (data: { idempotencyKey: string; username: string }) =>
      createAccountUsername({ data }),
  });
}
