import { z } from "zod";

export const LIGHTFAST_REPOSITORY_NAME = ".lightfast" as const;

export const ORG_SETUP_REQUIREMENTS = [
  "github_org",
  "github_lightfast_repo",
  "x_connector",
] as const;

export type OrgSetupRequirement = (typeof ORG_SETUP_REQUIREMENTS)[number];

export const orgSetupRequirementSchema = z.enum(ORG_SETUP_REQUIREMENTS);

export const orgSetupGateSchema = z.discriminatedUnion("bindingStatus", [
  z.object({
    bindingStatus: z.literal("bound"),
    nextSetupRequirement: z.null(),
  }),
  z.object({
    bindingStatus: z.literal("unbound"),
    nextSetupRequirement: orgSetupRequirementSchema,
  }),
]);

export type OrgSetupGate = z.infer<typeof orgSetupGateSchema>;

export type OrgSetupRepairId =
  | "setup-github-org"
  | "setup-github-lightfast-repo"
  | "setup-x-connector";

export function repairIdForSetupRequirement(
  requirement: OrgSetupRequirement
): OrgSetupRepairId {
  switch (requirement) {
    case "github_org":
      return "setup-github-org";
    case "github_lightfast_repo":
      return "setup-github-lightfast-repo";
    case "x_connector":
      return "setup-x-connector";
    default: {
      const exhaustive: never = requirement;
      return exhaustive;
    }
  }
}

export const githubLightfastRepositoryProofSchema = z.object({
  fullName: z.string().min(1),
  id: z.string().min(1),
  installationId: z.string().min(1),
  name: z.literal(LIGHTFAST_REPOSITORY_NAME),
  verifiedAt: z.string().datetime(),
});

export type GitHubLightfastRepositoryProof = z.infer<
  typeof githubLightfastRepositoryProofSchema
>;

export const APP_SETUP_ERROR_CODES = [
  "github_transient_error",
  "lightfast_repo_missing",
  "lightfast_repo_inaccessible",
] as const;

export const appSetupErrorCodeSchema = z.enum(APP_SETUP_ERROR_CODES);
export type AppSetupErrorCode = z.infer<typeof appSetupErrorCodeSchema>;
