/**
 * Recipient filtering for notification targeting
 *
 * Filters org members based on the targeting rule from the notification rubric.
 * V1: Only supports all_members and actor_excluded/actor_aware.
 * Reviewers/assignee targeting requires GitHub API integration (future).
 */

import type { TargetingRule } from "@repo/console-types";

export interface Recipient {
  id: string;
  email: string;
  name?: string | undefined;
}

/**
 * Filter recipients based on the targeting rule.
 * V1: Only supports all_members and actor_excluded/actor_aware.
 * Reviewers/assignee targeting requires GitHub API integration (future).
 */
export function filterByTargetingRule(
  allMembers: Recipient[],
  rule: TargetingRule,
  actorSourceId?: string,
): Recipient[] {
  switch (rule) {
    case "actor_excluded":
      // Remove the person who triggered the event
      if (!actorSourceId) return allMembers;
      return allMembers.filter((m) => !matchesActor(m, actorSourceId));

    case "actor_aware":
      // Include everyone — dispatch will use different template for actor
      return allMembers;

    case "all_members":
    case "owner_only":
    case "assignee_only":
    case "reviewers_only":
      // V1: Fall through to all members for targeting rules
      // that require GitHub API integration
      return allMembers;

    default:
      return allMembers;
  }
}

function matchesActor(_member: Recipient, _actorSourceId: string): boolean {
  // actorSourceId format: "github:{numericId}" or "github:{username}"
  // We can't match this to Clerk userId without a linking table
  // For V1, we skip actor filtering if we can't match
  // TODO: Build actor -> Clerk user linking
  return false;
}
