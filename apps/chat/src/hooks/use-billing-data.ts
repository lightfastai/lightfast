"use client";

import { useMemo } from "react";
import { usePaymentAttempts } from "@clerk/nextjs/experimental";
import { ClerkPlanKey, getClerkPlanId } from "@repo/chat-billing";
import { useTRPC } from "@repo/chat-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

/**
 * Clerk's `@clerk/backend` and experimental `@clerk/nextjs/experimental` modules
 * produce error-typed values when their deep re-export chains fail to resolve.
 *
 * We define the shapes we actually consume and cast through `unknown` so that
 * eslint's strict type-safety rules are satisfied without `eslint-disable`.
 */

// -- Subscription types (from @clerk/backend BillingSubscription) -----------

interface BillingMoneyAmount {
	amount: number;
	currency: string;
	currencySymbol: string;
}

interface BillingPlan {
	id: string;
	name: string;
	[key: string]: unknown;
}

interface BillingSubscriptionItem {
	id: string;
	status: string;
	planPeriod: "month" | "annual";
	periodStart: number;
	nextPayment: { amount: number; date: number } | null | undefined;
	amount: BillingMoneyAmount | undefined;
	plan: BillingPlan | null;
	planId: string | null;
	createdAt: number;
	updatedAt: number;
	periodEnd: number | null;
	canceledAt: number | null;
	pastDueAt: number | null;
	endedAt: number | null;
	payerId: string | undefined;
	isFreeTrial?: boolean | undefined;
	lifetimePaid?: BillingMoneyAmount | undefined;
}

interface BillingSubscription {
	id: string;
	status: string;
	payerId: string;
	createdAt: number;
	updatedAt: number;
	activeAt: number | null;
	pastDueAt: number | null;
	subscriptionItems: BillingSubscriptionItem[];
	nextPayment: { date: number; amount: BillingMoneyAmount } | null;
	eligibleForFreeTrial: boolean;
}

// -- Payment attempt types (from @clerk/shared BillingPaymentResource) ------

interface BillingPaymentAttempt {
	id: string;
	status: string;
	amount: BillingMoneyAmount;
	updatedAt: Date;
}

interface UsePaymentAttemptsReturn {
	data: BillingPaymentAttempt[];
	isLoading: boolean;
	error: unknown;
	revalidate: () => Promise<void>;
}

export function useBillingData() {
	const trpc = useTRPC();

	const { data: rawSubscription, refetch: refetchSubscription } =
		useSuspenseQuery({
			...trpc.billing.getSubscription.queryOptions(),
			staleTime: 2 * 60 * 1000,
			refetchOnMount: false,
			refetchOnWindowFocus: false,
		});

	// Cast subscription through `unknown` — the tRPC return type is a Clerk
	// `BillingSubscription` class whose deep type chain doesn't resolve for eslint.
	const subscription = rawSubscription as unknown as BillingSubscription | null;

	const {
		data: paymentAttempts,
		isLoading: paymentsLoading,
		error: paymentsError,
		revalidate: revalidatePaymentAttempts,
	} = usePaymentAttempts() as unknown as UsePaymentAttemptsReturn;

	// Derive billing state from raw Clerk subscription
	const derived = useMemo(() => {
		const freePlanId = getClerkPlanId(ClerkPlanKey.FREE_TIER);
		const allItems = subscription?.subscriptionItems ?? [];
		const paidSubscriptionItems = allItems.filter(
			(item) => item.plan?.id !== freePlanId,
		);

		// During plan transitions Clerk keeps multiple items (e.g. old "canceled"
		// + new "upcoming"). Use the active item for state derivation.
		const activePaidItem =
			paidSubscriptionItems.find((item) => item.status === "active") ?? null;

		const hasActiveSubscription =
			subscription?.status === "active" && activePaidItem != null;
		const isCanceled = activePaidItem?.canceledAt != null;
		const nextPaymentDate = subscription?.nextPayment?.date;
		const nextBillingDate = nextPaymentDate
			? new Date(nextPaymentDate).toISOString()
			: null;
		const billingInterval =
			(activePaidItem ?? paidSubscriptionItems[0])?.planPeriod === "annual"
				? ("annual" as const)
				: ("month" as const);

		return {
			paidSubscriptionItems,
			activePaidItem,
			hasActiveSubscription,
			isCanceled,
			nextBillingDate,
			billingInterval,
		};
	}, [subscription]);

	const sortedPayments = useMemo(() => {
		return [...paymentAttempts].sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);
	}, [paymentAttempts]);

	const failedPayments = useMemo(() => {
		return sortedPayments.filter((attempt) => attempt.status === "failed");
	}, [sortedPayments]);

	return {
		// Raw Clerk subscription
		subscription,
		refreshSubscription: () =>
			refetchSubscription().catch(() => undefined),

		// Derived billing state
		...derived,

		// Payment data
		payments: sortedPayments,
		failedPayments,
		paymentsLoading,
		paymentsError,
		revalidatePayments: () =>
			revalidatePaymentAttempts().catch(() => undefined),
	};
}
