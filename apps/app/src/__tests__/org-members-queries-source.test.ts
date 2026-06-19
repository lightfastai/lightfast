import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org members app data access", () => {
  it("keeps org member cache primitives without a query-options wrapper", () => {
    const queriesPath = "src/org/settings/members/org-member-queries.ts";
    const cacheSource = readFileSync(
      resolve(appRoot, "src/org/settings/members/org-member-cache.ts"),
      "utf8"
    );
    const listSource = readFileSync(
      resolve(appRoot, "src/org/settings/members/org-member-list.tsx"),
      "utf8"
    );
    const avatarSource = readFileSync(
      resolve(appRoot, "src/signals/signals-creator-avatar.tsx"),
      "utf8"
    );

    expect(existsSync(resolve(appRoot, queriesPath))).toBe(false);
    expect(cacheSource).toContain(
      'import type { ListOrgMembersResult } from "@api/app/tanstack/org-members"'
    );
    expect(cacheSource).toContain("orgMemberListQueryKey");
    expect(cacheSource).toContain('["org-members", "list", orgId ?? "no-org"]');
    expect(cacheSource).not.toContain("queryOptions");
    expect(cacheSource).not.toContain("listOrgMembers");
    expect(listSource).toContain('@api/app/tanstack/org-members"');
    expect(listSource).toContain("listOrgMembers");
    expect(listSource).toContain("queryKey: listQueryKey");
    expect(listSource).not.toContain("orgMembersQueryOptions");
    expect(avatarSource).toContain('@api/app/tanstack/org-members"');
    expect(avatarSource).toContain("listOrgMembers");
    expect(avatarSource).toContain("queryKey: orgMemberListQueryKey(orgId)");
    expect(avatarSource).not.toContain("orgMembersQueryOptions");
  });

  it("removes org member settings UI callers from tRPC", () => {
    const files = [
      "src/org/settings/members/org-member-list.tsx",
      "src/org/settings/members/org-member-invite.tsx",
      "src/org/settings/members/org-member-cache.ts",
      "src/signals/signals-creator-avatar.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("org.settings.orgMembers");
      expect(source, file).not.toContain("AppRouterOutputs");
    }
  });

  it("keeps member invite mutation state in the invite component", () => {
    const inviteSource = readFileSync(
      resolve(appRoot, "src/org/settings/members/org-member-invite.tsx"),
      "utf8"
    );
    const actionsPath = "src/org/settings/members/org-member-invite-actions.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(inviteSource).toContain('@api/app/tanstack/org-members"');
    expect(inviteSource).toContain("inviteOrgMember");
    expect(inviteSource).toContain("useMutation");
    expect(inviteSource).toContain("useQueryClient");
    expect(inviteSource).not.toContain("inviteOrgMemberMutationOptions");
    expect(inviteSource).toContain("orgMemberListQueryKey(orgId)");
    expect(inviteSource).toContain("createOptimisticInvitation");
    expect(inviteSource).not.toContain("useOrgMemberInviteAction");
    expect(inviteSource).not.toContain("org-member-invite-actions");
  });

  it("keeps member list mutation state in the list component", () => {
    const listSource = readFileSync(
      resolve(appRoot, "src/org/settings/members/org-member-list.tsx"),
      "utf8"
    );
    const actionsPath = "src/org/settings/members/org-member-list-actions.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(listSource).toContain('@api/app/tanstack/org-members"');
    expect(listSource).toContain("updateOrgMemberRole");
    expect(listSource).toContain("removeOrgMember");
    expect(listSource).toContain("revokeOrgInvitation");
    expect(listSource).toContain("useMutation");
    expect(listSource).toContain("useQueryClient");
    expect(listSource).not.toContain("updateOrgMemberRoleMutationOptions");
    expect(listSource).not.toContain("removeOrgMemberMutationOptions");
    expect(listSource).not.toContain("revokeOrgInvitationMutationOptions");
    expect(listSource).toContain("orgMemberListQueryKey(orgId)");
    expect(listSource).toContain("updateMemberRole");
    expect(listSource).toContain("restoreMember");
    expect(listSource).toContain("restoreInvitation");
    expect(listSource).not.toContain("useOrgMemberListActions");
    expect(listSource).not.toContain("org-member-list-actions");
  });

  it("surfaces expected domain errors from TanStack mutations", () => {
    const source = readFileSync(
      resolve(appRoot, "src/query/react.tsx"),
      "utf8"
    );

    expect(source).toContain("isExpectedDomainError");
    expect(source).toContain('error.name === "DomainError"');
    expect(source).toContain("? error.message");
  });
});
