"use client";

import * as React from "react";
import type { ClerkPlanKey } from "~/lib/billing/types";
import { CurrentPlanSection } from "./current-plan-section";
import { PaymentHistorySection } from "./payment-history-section";

interface BillingManagementProps {
	currentPlan: ClerkPlanKey;
}

export function BillingManagement({ currentPlan }: BillingManagementProps) {
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

				<div className="grid gap-6">
					<CurrentPlanSection currentPlan={currentPlan} />
					<PaymentHistorySection />
				</div>
			</div>
		</div>
	);
}
