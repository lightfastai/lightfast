"use client";

import * as React from "react";
import { ClerkPlanKey } from "@repo/chat-billing";
import { PlanHeaderSection } from "./plan-header-section";
import { PaymentMethodSection } from "./payment-method-section";
import { PaymentHistorySection } from "./payment-history-section";
import { CancellationSection } from "./cancellation-section";
import { FreePlanFeaturesSection } from "./free-plan-features-section";
import { FailedPaymentsAlert } from "./failed-payments-alert";
import { useBillingData } from "~/hooks/use-billing-data";

interface BillingManagementProps {
	currentPlan: ClerkPlanKey;
}

export function BillingManagement({ currentPlan }: BillingManagementProps) {
	const { hasActiveSubscription } = useBillingData();

	const isPaidPlan = hasActiveSubscription || currentPlan === ClerkPlanKey.PLUS_TIER;
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
