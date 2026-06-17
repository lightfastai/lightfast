import {
  startGitHubOrgSetup,
  syncGitHubBindingClaim,
  verifyGitHubLightfastRepo,
} from "@api/app/tanstack/github-setup";
import { mutationOptions } from "@tanstack/react-query";

interface StartGitHubOrgSetupInput {
  orgSlug: string;
}

interface MutationOptionsInput {
  errorTitle?: string;
}

export function startGitHubOrgSetupMutationOptions(
  input: MutationOptionsInput = {}
) {
  return mutationOptions({
    meta: { errorTitle: input.errorTitle ?? "Failed to connect GitHub" },
    mutationFn: (data: StartGitHubOrgSetupInput) =>
      startGitHubOrgSetup({ data }),
  });
}

export function syncGitHubBindingClaimMutationOptions(
  input: MutationOptionsInput = {}
) {
  return mutationOptions({
    meta: {
      errorTitle: input.errorTitle ?? "Failed to finish GitHub connection",
    },
    mutationFn: () => syncGitHubBindingClaim(),
  });
}

export function verifyGitHubLightfastRepoMutationOptions(
  input: MutationOptionsInput = {}
) {
  return mutationOptions({
    meta: { errorTitle: input.errorTitle ?? "Failed to verify .lightfast" },
    mutationFn: () => verifyGitHubLightfastRepo(),
  });
}
