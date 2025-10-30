/**
 * Plain types for billing data - avoiding direct Clerk type references
 * These match the JSON.stringified output of Clerk's billing objects
 */

export interface SubscriptionData {
  id: string;
  status: string;
  payerId: string;
  createdAt: number;
  updatedAt: number;
  activeAt: number | null;
  pastDueAt: number | null;
  subscriptionItems: SubscriptionItemData[];
  nextPayment: {
    date: number;
    amount: {
      value: number;
      currency: string;
    };
  } | null;
  eligibleForFreeTrial: boolean;
}

export interface SubscriptionItemData {
  id: string;
  status: string;
  planPeriod: 'month' | 'annual';
  periodStart: number;
  periodEnd: number | null;
  nextPayment: {
    amount: number;
    date: number;
  } | null;
  amount?: {
    value: number;
    currency: string;
  } | null;
  plan?: {
    id: string;
    name: string;
  } | null;
  planId: string | null;
  createdAt: number;
  updatedAt: number;
  canceledAt: number | null;
  pastDueAt: number | null;
  endedAt: number | null;
  payerId: string;
  isFreeTrial?: boolean;
  lifetimePaid?: {
    value: number;
    currency: string;
  } | null;
}
