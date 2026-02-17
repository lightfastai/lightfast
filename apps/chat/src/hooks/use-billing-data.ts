"use client";

import { useMemo } from "react";
import { usePaymentAttempts } from "@clerk/nextjs/experimental";
import { useTRPC } from "@repo/chat-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

const FREE_PLAN_IDS = ["cplan_free", "free-tier"];

export function useBillingData() {
	const trpc = useTRPC();

	const { data: subscription, refetch: refetchSubscription } =
		useSuspenseQuery({
			...trpc.billing.getSubscription.queryOptions(),
			staleTime: 2 * 60 * 1000,
			refetchOnMount: false,
			refetchOnWindowFocus: false,
		});

	const {
		data: paymentAttempts,
		isLoading: paymentsLoading,
		error: paymentsError,
		revalidate: revalidatePaymentAttempts,
	} = usePaymentAttempts();

	// Derive billing state from raw Clerk subscription
	const derived = useMemo(() => {
		// Item type for the null-subscription fallback
		type SubscriptionItem = NonNullable<typeof subscription>["subscriptionItems"][number];

		if (!subscription) {
			return {
				paidSubscriptionItems: [] as SubscriptionItem[],
				activePaidItem: null as SubscriptionItem | null,
				hasActiveSubscription: false,
				isCanceled: false,
				nextBillingDate: null as string | null,
				billingInterval: "month" as const,
			};
		}

		const allItems = subscription.subscriptionItems;
		const paidSubscriptionItems = allItems.filter((item) => {
			const planId = item.plan?.id ?? "";
			const planName = item.plan?.name ?? "";
			return (
				!FREE_PLAN_IDS.includes(planId) && !FREE_PLAN_IDS.includes(planName)
			);
		});

		// During plan transitions Clerk keeps multiple items (e.g. old "canceled"
		// + new "upcoming"). Use the active item for state derivation.
		const activePaidItem =
			paidSubscriptionItems.find((item) => item.status === "active") ?? null;

		const hasActiveSubscription =
			subscription.status === "active" && activePaidItem != null;
		const isCanceled = activePaidItem?.canceledAt != null;
		const nextPaymentDate = subscription.nextPayment?.date;
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
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!paymentAttempts) return [];
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
