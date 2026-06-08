import "@tanstack/react-start/server-only";

export type {
  AllowlistIdentifier,
  Client,
  EmailAddress,
  Invitation,
  Organization,
  OrganizationDomain,
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationMembershipPublicUserData,
  OrganizationMembershipRole,
  PhoneNumber,
  Session,
  SignInToken,
  SMSMessage,
  Token,
  User,
  WebhookEvent,
  WebhookEventType,
} from "@clerk/tanstack-react-start/server";
export {
  auth,
  clerkClient,
  clerkMiddleware,
} from "@clerk/tanstack-react-start/server";

import {
  auth,
  clerkClient,
  type User,
} from "@clerk/tanstack-react-start/server";

export interface APIKey {
  id: string;
}

export interface BillingMoneyAmount {
  amountFormatted: string;
  currencySymbol: string;
}

export interface BillingPlan {
  fee?: BillingMoneyAmount | null;
  isDefault: boolean;
  slug: string;
}

export interface BillingSubscriptionItem {
  id: string;
  plan?: BillingPlan | null;
  status: string;
}

export interface BillingSubscription {
  subscriptionItems: BillingSubscriptionItem[];
}

export function toPlainClerkResource<T>(resource: T): T {
  return structuredClone(resource);
}

export function createRouteMatcher() {
  return () => false;
}

export async function currentUser(): Promise<User | null> {
  const { userId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) {
    return null;
  }
  return clerkClient().users.getUser(userId);
}

export async function getAuth() {
  return auth({ treatPendingAsSignedOut: false });
}

export function buildClerkProps() {
  return {};
}

export function reverificationError() {
  return new Error("Reverification is not implemented for app-tanstack yet.");
}

export function reverificationErrorResponse() {
  return new Response(null, { status: 403 });
}
