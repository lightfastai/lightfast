"use client";

import { useMemo } from "react";
import { usePaymentAttempts } from "@clerk/nextjs/experimental";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

export function useBillingData() {
	const trpc = useTRPC();

	// Get subscription data from TRPC
	const { data: subscriptionData, refetch: refetchSubscription } = useSuspenseQuery({
		...trpc.billing.getSubscription.queryOptions(),
		staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
		refetchOnMount: false, // Prevent blocking navigation
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});

	// Get payment attempts from Clerk
	const {
		data: paymentAttempts,
		isLoading: paymentsLoading,
		error: paymentsError,
		revalidate: revalidatePaymentAttempts,
	} = usePaymentAttempts();

	// Sort payment attempts by date (most recent first)
	const sortedPayments = useMemo(() => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!paymentAttempts) {
			return [];
		}
		return [...paymentAttempts].sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);
	}, [paymentAttempts]);

	// Get failed payments for alerts
	const failedPayments = useMemo(() => {
		return sortedPayments.filter((attempt) => attempt.status === "failed");
	}, [sortedPayments]);

	return {
		// Subscription data
		subscription: subscriptionData,
		refreshSubscription: () =>
			refetchSubscription().catch(() => undefined),
		
		// Payment data
		payments: sortedPayments,
		failedPayments,
		paymentsLoading,
		paymentsError,
		revalidatePayments: () =>
			revalidatePaymentAttempts().catch(() => undefined),
		
		// Convenience flags
		hasActiveSubscription: subscriptionData.hasActiveSubscription,
		isCanceled: subscriptionData.isCanceled,
		nextBillingDate: subscriptionData.nextBillingDate,
	};
}
