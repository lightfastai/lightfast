"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, CreditCard, Calendar } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { ClerkPlanKey } from "@repo/chat-billing";
import { getPlanPricing } from "@repo/chat-billing/pricing";
import { useBillingData } from "~/hooks/use-billing-data";

interface PlanHeaderSectionProps {
	currentPlan: ClerkPlanKey;
}

export function PlanHeaderSection({ currentPlan }: PlanHeaderSectionProps) {
	const { hasActiveSubscription, isCanceled, nextBillingDate } = useBillingData();

	const currentPlanPricing = getPlanPricing(currentPlan);

	// Generate subtitle based on plan
	const getSubtitle = () => {
		if (currentPlan === ClerkPlanKey.FREE_TIER) {
			return "Get started with AI-powered conversations";
		}

		if (isCanceled) {
			return "Your plan has been cancelled";
		}

		return "20x more usage than Pro";
	};

	// Generate renewal info
	const getRenewalInfo = () => {
		if (currentPlan === ClerkPlanKey.FREE_TIER) {
			return null;
		}

		if (isCanceled) {
			// Use next billing date if available (it's an ISO string from tRPC)
			if (nextBillingDate) {
				const date = new Date(nextBillingDate);
				const formattedDate = date.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
				return `Your plan expires on ${formattedDate}`;
			}
			return "Your plan has been cancelled";
		}

		if (!hasActiveSubscription || !nextBillingDate) {
			return null;
		}

		const renewalDate = new Date(nextBillingDate).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
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
				<p className="text-sm text-muted-foreground">{getSubtitle()}</p>
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
						<Link href="/billing/upgrade">Upgrade Plan</Link>
					</Button>
				</div>
			)}
		</div>
	);
}
