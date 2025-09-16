"use client";

import * as React from "react";
import { ClerkPlanKey } from "~/lib/billing/types";
import { PlanHeaderSection } from "./plan-header-section";
import { PaymentMethodSection } from "./payment-method-section";
import { PaymentHistorySection } from "./payment-history-section";
import { CancellationSection } from "./cancellation-section";
import { FreePlanFeaturesSection } from "./free-plan-features-section";
import { FailedPaymentsAlert } from "./failed-payments-alert";

interface BillingManagementProps {
	currentPlan: ClerkPlanKey;
}

export function BillingManagement({ currentPlan }: BillingManagementProps) {
	const isPaidPlan = currentPlan === ClerkPlanKey.PLUS_TIER;
	const isFreePlan = currentPlan === ClerkPlanKey.FREE_TIER;

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8 max-w-4xl">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Billing & Subscription
					</h1>
					<p className="text-muted-foreground">
						Manage your subscription, usage, and billing preferences
					</p>
				</div>

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
			</div>
		</div>
	);
}
