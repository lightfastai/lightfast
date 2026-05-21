import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type {
  APIKey,
  BillingPlan,
  BillingSubscription,
  BillingSubscriptionItem,
} from "@clerk/backend";
export type {
  AllowlistIdentifier,
  ClerkMiddlewareAuth,
  ClerkMiddlewareOptions,
  ClerkMiddlewareSessionAuthObject,
  Client,
  DeletedObjectJSON,
  EmailAddress,
  EmailJSON,
  EmailWebhookEvent,
  ExternalAccount,
  Invitation,
  OauthAccessToken,
  Organization,
  OrganizationDomainJSON,
  OrganizationDomainVerificationJSON,
  OrganizationDomainWebhookEvent,
  OrganizationInvitation,
  OrganizationInvitationJSON,
  OrganizationInvitationWebhookEvent,
  OrganizationJSON,
  OrganizationMembership,
  OrganizationMembershipJSON,
  OrganizationMembershipPublicUserData,
  OrganizationMembershipRole,
  OrganizationMembershipWebhookEvent,
  OrganizationWebhookEvent,
  PermissionWebhookEvent,
  PhoneNumber,
  RoleWebhookEvent,
  Session,
  SessionJSON,
  SessionWebhookEvent,
  SignInToken,
  SMSMessage,
  SMSMessageJSON,
  SMSWebhookEvent,
  Token,
  User,
  UserJSON,
  UserWebhookEvent,
  WaitlistEntryJSON,
  WaitlistEntryWebhookEvent,
  WebhookEvent,
  WebhookEventType,
} from "@clerk/nextjs/server";
export {
  auth,
  buildClerkProps,
  clerkClient,
  clerkMiddleware,
  createClerkClient,
  createRouteMatcher,
  currentUser,
  getAuth,
  reverificationError,
  reverificationErrorResponse,
  verifyToken,
} from "@clerk/nextjs/server";
export type { BillingMoneyAmount } from "@clerk/shared/types";

export const clerkEnvBase = createEnv({
  shared: {},
  server: {
    CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

export function getClerkFrontendApi(): string {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return "";
  }

  const base64Part = publishableKey.split("_")[2];

  if (!base64Part) {
    return "";
  }

  try {
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
    const domain = decoded.replace(/\$$/, "");
    return `https://${domain}`;
  } catch {
    return "";
  }
}

export function toPlainClerkResource<T>(resource: T): T {
  return structuredClone(resource);
}

export interface UserOrgMembership {
  imageUrl: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  role: string;
}

export async function getUserOrgMemberships(
  userId: string
): Promise<UserOrgMembership[]> {
  const clerk = await clerkClient();

  const response = await clerk.users.getOrganizationMembershipList({
    userId,
  });

  return response.data.map((membership) => ({
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    organizationName: membership.organization.name,
    role: membership.role,
    imageUrl: membership.organization.imageUrl,
  }));
}
