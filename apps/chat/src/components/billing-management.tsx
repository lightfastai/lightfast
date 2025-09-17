"use client";

import * as React from "react";
import { ClerkPlanKey } from "~/lib/billing/types";
import { PlanHeaderSection } from "./plan-header-section";
import { PaymentMethodSection } from "./payment-method-section";
import { PaymentHistorySection } from "./payment-history-section";
import { CancellationSection } from "./cancellation-section";
import { FreePlanFeaturesSection } from "./free-plan-features-section";
import { FailedPaymentsAlert } from "./failed-payments-alert";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

interface BillingManagementProps {
	currentPlan: ClerkPlanKey;
}

export function BillingManagement({ currentPlan }: BillingManagementProps) {
	const trpc = useTRPC();
	
	// Get subscription data to determine actual plan state
	const { data: subscriptionData } = useSuspenseQuery({
		...trpc.billing.getSubscription.queryOptions(),
		staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
		refetchOnMount: false, // Prevent blocking navigation
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});

	// Determine plan state from subscription data
	const isPaidPlan = subscriptionData.hasActiveSubscription || currentPlan === ClerkPlanKey.PLUS_TIER;
	const isFreePlan = !isPaidPlan;

	return (
		<div className="space-y-6">
			{isPaidPlan && (
				<>
					{/* Layout for PAID PLANS (ClerkPlanKey.PLUS_TIER) */}
					<PlanHeaderSection currentPlan={currentPlan} />
					<PaymentMethodSection currentPlan={currentPlan} />
					<FailedPaymentsAlert />
					<PaymentHistorySection />
					<CancellationSection currentPlan={currentPlan} />
				</>
			)}

			{isFreePlan && (
				<>
					{/* Layout for FREE PLANS (ClerkPlanKey.FREE_TIER) */}
					<FreePlanFeaturesSection currentPlan={currentPlan} />
				</>
			)}
		</div>
	);
}
