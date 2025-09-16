"use client";
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import * as React from "react";
import Link from "next/link";
import { Crown, CreditCard, Calendar } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { ClerkPlanKey } from "~/lib/billing/types";
import { getPlanPricing } from "~/lib/billing/pricing";
import { useSubscriptionState } from "~/hooks/use-subscription-state";

interface PlanHeaderSectionProps {
	currentPlan: ClerkPlanKey;
}

export function PlanHeaderSection({ currentPlan }: PlanHeaderSectionProps) {
	const {
		hasActiveSubscription,
		isCanceled,
		nextBillingDate,
		isLoading,
		error,
	} = useSubscriptionState();

	const currentPlanPricing = getPlanPricing(currentPlan);

	// Handle loading state
	if (isLoading) {
		return <PlanHeaderSectionSkeleton />;
	}

	// Handle error state
	if (error) {
		return (
			<div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
				<div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
					<CreditCard className="w-5 h-5 text-muted-foreground" />
				</div>
				<div className="flex-1">
					<h2 className="text-lg font-semibold text-foreground">
						Unable to load plan
					</h2>
					<p className="text-sm text-muted-foreground">
						{error instanceof Error ? error.message : "Failed to retrieve subscription information"}
					</p>
				</div>
			</div>
		);
	}

	// Generate subtitle based on plan
	const getSubtitle = () => {
		if (currentPlan === ClerkPlanKey.FREE_TIER) {
			return "Get started with AI-powered conversations";
		}
		
		if (currentPlan === ClerkPlanKey.PLUS_TIER) {
			if (isCanceled) {
				return "Your plan has been cancelled";
			}
			return "20x more usage than Pro";
		}
		
		return currentPlanPricing.description;
	};

	// Generate renewal info
	const getRenewalInfo = () => {
		if (currentPlan === ClerkPlanKey.FREE_TIER) {
			return null;
		}

		if (isCanceled) {
			// Use next billing date if available
			if (nextBillingDate && nextBillingDate instanceof Date) {
				const formattedDate = nextBillingDate.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});
				return `Your plan expires on ${formattedDate}`;
			}
			return "Your plan has been cancelled";
		}

		if (!hasActiveSubscription || !nextBillingDate || !(nextBillingDate instanceof Date)) {
			return null;
		}

		const renewalDate = nextBillingDate.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});

		return `Your subscription will auto renew on ${renewalDate}`;
	};

	// Get plan icon
	const getPlanIcon = () => {
		if (currentPlan === ClerkPlanKey.PLUS_TIER) {
			return <Crown className="w-5 h-5 text-amber-500" />;
		}
		return <CreditCard className="w-5 h-5 text-muted-foreground" />;
	};

	const renewalInfo = getRenewalInfo();

	return (
		<div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
			{/* Plan Icon */}
			<div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
				{getPlanIcon()}
			</div>
			
			{/* Plan Info */}
			<div className="flex-1 min-w-0">
				<h2 className="text-lg font-semibold text-foreground">
					{currentPlanPricing.name} plan
				</h2>
				<p className="text-sm text-muted-foreground">
					{getSubtitle()}
				</p>
				{renewalInfo && !isCanceled && (
					<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
						<Calendar className="w-3 h-3" />
						{renewalInfo}
					</p>
				)}
			</div>

			{/* Right side content for cancelled subscriptions */}
			{isCanceled && currentPlan === ClerkPlanKey.PLUS_TIER && (
				<div className="flex-shrink-0">
					<Button asChild variant="default" size="sm">
						<Link href="/billing/upgrade">
							Upgrade Plan
						</Link>
					</Button>
				</div>
			)}
		</div>
	);
}

function PlanHeaderSectionSkeleton() {
	return (
		<div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
			{/* Icon skeleton */}
			<div className="w-10 h-10 rounded-lg bg-muted animate-pulse flex-shrink-0" />
			
			{/* Content skeleton */}
			<div className="flex-1 space-y-2">
				<div className="h-5 bg-muted rounded w-24 animate-pulse" />
				<div className="h-4 bg-muted rounded w-40 animate-pulse" />
				<div className="h-3 bg-muted rounded w-48 animate-pulse" />
			</div>
		</div>
	);
}