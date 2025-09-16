"use client";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import * as React from "react";
import Link from "next/link";
import {
	useSubscription,
} from "@clerk/nextjs/experimental";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	CreditCard,
	Calendar,
	TrendingUp,
} from "lucide-react";
import { ClerkPlanKey, getClerkPlanId } from "~/lib/billing/types";
import type { BillingInterval } from "~/lib/billing/types";
import { getPlanPricing, getPricingForInterval } from "~/lib/billing/pricing";

interface CurrentPlanSectionProps {
	currentPlan: ClerkPlanKey;
}

export function CurrentPlanSection({ currentPlan }: CurrentPlanSectionProps) {
	const {
		data: subscription,
		isLoading,
		error,
		revalidate,
	} = useSubscription();
	const currentPlanPricing = getPlanPricing(currentPlan);


	// Handle loading and error states
	if (isLoading) {
		return <CurrentPlanSectionSkeleton />;
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Failed to Load Plan Information</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">
						{String(error?.message || "An error occurred")}
					</p>
					<Button onClick={revalidate}>Retry</Button>
				</CardContent>
			</Card>
		);
	}

	// Filter out free tier subscription items - only work with paid plans
	const freeTierPlanId = getClerkPlanId(ClerkPlanKey.FREE_TIER);
	const paidSubscriptionItems = subscription?.subscriptionItems?.filter(
		(item) => item?.plan?.id !== freeTierPlanId && item?.plan?.name !== "free-tier"
	) ?? [];

	// Get subscription data (only from paid subscription items)
	const hasActiveSubscription = subscription?.status === "active" && paidSubscriptionItems.length > 0;
	const isCanceled = paidSubscriptionItems[0]?.canceledAt != null;
	const nextBillingDate = subscription?.nextPayment?.date;

	const billingInterval: BillingInterval =
		paidSubscriptionItems.length > 0 && 
		paidSubscriptionItems[0]?.planPeriod === "annual"
			? "annual"
			: "month";


	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CreditCard className="w-5 h-5" />
					Current Plan
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<div className="flex items-center gap-3 mb-2">
							<h3 className="text-xl font-semibold text-foreground">
								{currentPlanPricing.name} Plan
							</h3>
							{currentPlan === ClerkPlanKey.PLUS_TIER && (
								<Badge variant={isCanceled ? "secondary" : "default"}>
									{isCanceled ? "Canceled" : "Active"}
								</Badge>
							)}
						</div>
						<p className="text-muted-foreground mb-3">
							{currentPlanPricing.description}
						</p>

						{hasActiveSubscription && nextBillingDate && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Calendar className="w-4 h-4" />
								<span>
									Next billing: {nextBillingDate.toLocaleDateString()}(
									{billingInterval === "annual" ? "Annual" : "Monthly"})
								</span>
							</div>
						)}
					</div>

					<div className="text-right">
						{currentPlan === ClerkPlanKey.FREE_TIER ? (
							<div className="text-2xl font-bold text-foreground">Free</div>
						) : (
							<div>
								<div className="text-2xl font-bold text-foreground">
									${getPricingForInterval(currentPlan, billingInterval).price}
								</div>
								<div className="text-sm text-muted-foreground">
									{billingInterval === "annual"
										? "/month (billed annually)"
										: "/month"}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex gap-3 pt-4 border-t">
					{currentPlan === ClerkPlanKey.FREE_TIER ? (
						<Button asChild className="flex items-center gap-2">
							<Link href="/billing/upgrade">
								<TrendingUp className="w-4 h-4" />
								Upgrade to Plus
							</Link>
						</Button>
					) : (
						hasActiveSubscription && (
							<Button variant="outline" disabled>
								Manage Subscription
							</Button>
						)
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function CurrentPlanSectionSkeleton() {
	return (
		<div className="space-y-6">
			{[1, 2, 3].map((i) => (
				<Card key={i}>
					<CardHeader>
						<div className="h-6 bg-muted rounded w-32" />
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="h-4 bg-muted rounded w-full" />
							<div className="h-4 bg-muted rounded w-3/4" />
							<div className="h-4 bg-muted rounded w-1/2" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
