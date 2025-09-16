"use client";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	useSubscription,
	usePaymentAttempts,
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
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
	CreditCard,
	Calendar,
	TrendingUp,
	ArrowRight,
	XCircle,
} from "lucide-react";
import { toast } from "@repo/ui/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ClerkPlanKey, getClerkPlanId } from "~/lib/billing/types";
import type { BillingInterval } from "~/lib/billing/types";
import { getPlanPricing, getPricingForInterval } from "~/lib/billing/pricing";
import { useTRPC } from "~/trpc/react";

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
	const {
		data: paymentAttempts,
		isLoading: attemptsLoading,
		error: attemptsError,
	} = usePaymentAttempts();
	const currentPlanPricing = getPlanPricing(currentPlan);
	const trpc = useTRPC();
	const router = useRouter();

	// Cancel subscription mutation
	const cancelSubscriptionMutation = useMutation(
		trpc.billing.cancelSubscriptionItem.mutationOptions({
			onSuccess: () => {
				toast({
					title: "Subscription Cancelled",
					description:
						"Your subscription has been cancelled successfully. You'll continue to have access until the end of your billing period.",
				});
				// Revalidate subscription data
				void revalidate();
				// Redirect to cancellation confirmation page with plan context
				router.push(
					`/billing/cancelled?plan=${currentPlan}&period=${billingInterval}`,
				);
			},
			onError: (error) => {
				toast({
					title: "Error",
					description:
						error.message || "Failed to cancel subscription. Please try again.",
					variant: "destructive",
				});
			},
		}),
	);

	// Handle loading and error states
	if (isLoading || attemptsLoading) {
		return <CurrentPlanSectionSkeleton />;
	}

	if (error || attemptsError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Failed to Load Plan Information</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">
						{String(error?.message || attemptsError?.message || "An error occurred")}
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

	// Sort payment attempts by date (most recent first)
	const sortedAttempts = paymentAttempts?.length 
		? [...paymentAttempts].sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			)
		: [];

	// Handle subscription cancellation
	const handleCancelSubscription = () => {
		if (!paidSubscriptionItems[0]?.id) {
			toast({
				title: "Error",
				description: "No active paid subscription found to cancel.",
				variant: "destructive",
			});
			return;
		}

		const confirmed = confirm(
			"Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.",
		);

		if (confirmed) {
			cancelSubscriptionMutation.mutate({
				subscriptionItemId: paidSubscriptionItems[0].id,
				endNow: false, // Cancel at end of billing period
			});
		}
	};

	return (
		<div className="space-y-6">
			{/* Current Plan Overview */}
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
								<>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="destructive"
													disabled={
														cancelSubscriptionMutation.isPending || isCanceled
													}
													onClick={handleCancelSubscription}
												>
													{cancelSubscriptionMutation.isPending
														? "Cancelling..."
														: "Cancel Subscription"}
												</Button>
											</TooltipTrigger>
											{isCanceled && (
												<TooltipContent>
													<p>Your plan has already been cancelled</p>
												</TooltipContent>
											)}
										</Tooltip>
									</TooltipProvider>
								</>
							)
						)}
					</div>
				</CardContent>
			</Card>

			{/* Failed Payments Alert - only show if there are failed payments */}
			{sortedAttempts.some((attempt) => attempt.status === "failed") && (
				<Card className="border-red-500/40 bg-red-50/50 dark:bg-red-950/20">
					<CardHeader>
						<CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
							<XCircle className="w-5 h-5" />
							Failed Payments
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-red-700 dark:text-red-300 mb-4">
							Some of your recent payments failed. This might affect your
							service access.
						</p>
						<Button
							asChild
							variant="outline"
							className="border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
						>
							<Link href="/billing">Update Payment Method</Link>
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Upgrade Prompt for Free Users */}
			{currentPlan === ClerkPlanKey.FREE_TIER && (
				<Card className="border-green-500/40 bg-green-50/50 dark:bg-green-950/20">
					<CardContent className="p-6">
						<div className="flex items-start gap-4">
							<div className="flex-1">
								<h3 className="font-semibold text-foreground mb-2">
									Ready to unlock more?
								</h3>
								<p className="text-sm text-muted-foreground mb-4">
									Upgrade to Plus for premium AI models, web search, and 100
									premium messages per month.
								</p>
								<Button
									asChild
									className="bg-green-600 hover:bg-green-700 text-white"
								>
									<Link href="/billing/upgrade">
										Upgrade to Plus
										<ArrowRight className="w-4 h-4 ml-2" />
									</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
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
