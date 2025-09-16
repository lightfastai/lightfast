"use client";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/prefer-optional-chain */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubscription, usePaymentAttempts } from "@clerk/nextjs/experimental";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/ui/table";
import {
	CreditCard,
	Calendar,
	TrendingUp,
	CheckCircle,
	ArrowRight,
	History,
	XCircle,
	Clock,
} from "lucide-react";
import { toast } from "@repo/ui/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ClerkPlanKey } from "~/lib/billing/types";
import type { BillingInterval } from "~/lib/billing/types";
import { getPlanPricing, getPricingForInterval } from "~/lib/billing/pricing";
import { useTRPC } from "~/trpc/react";

interface BillingManagementProps {
	currentPlan: ClerkPlanKey;
}

export function BillingManagement({ currentPlan }: BillingManagementProps) {
	// Use type assertion to handle experimental hook returning error types
	const {
		data: subscription,
		isLoading,
		error,
		revalidate,
	} = useSubscription();
	const { data: paymentAttempts, isLoading: attemptsLoading, error: attemptsError, revalidate: revalidateAttempts } = usePaymentAttempts();
	const currentPlanPricing = getPlanPricing(currentPlan);
	const trpc = useTRPC();
	const router = useRouter();

	// Cancel subscription mutation
	const cancelSubscriptionMutation = useMutation(
		trpc.billing.cancelSubscriptionItem.mutationOptions({
			onSuccess: () => {
				toast({
					title: "Subscription Cancelled",
					description: "Your subscription has been cancelled successfully. You'll continue to have access until the end of your billing period.",
				});
				// Revalidate subscription data
				void revalidate();
				// Redirect to cancellation confirmation page
				// Redirect to cancellation confirmation page with plan context
				router.push(`/billing/cancelled?plan=${currentPlan}&period=${billingInterval}`);
			},
			onError: (error) => {
				toast({
					title: "Error",
					description: error.message || "Failed to cancel subscription. Please try again.",
					variant: "destructive",
				});
			},
		})
	);


	// Handle loading and error states
	if (isLoading || attemptsLoading) {
		return <BillingManagementSkeleton />;
	}

	if (error || attemptsError) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<Card>
					<CardHeader>
						<CardTitle>Failed to Load Billing Information</CardTitle>
					</CardHeader>
					<CardContent className="text-center space-y-4">
						<p className="text-muted-foreground">
							{(error as Error)?.message ?? (attemptsError as Error)?.message ?? 'An error occurred'}
						</p>
						<div className="flex gap-2 justify-center">
							<Button onClick={revalidate}>Retry Subscription</Button>
							<Button onClick={revalidateAttempts} variant="outline">Retry Payments</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Get subscription data
	const hasActiveSubscription = subscription?.status === "active";
	const isCanceled = subscription?.subscriptionItems?.[0]?.canceledAt != null;
	const nextBillingDate = subscription?.nextPayment?.date;
	const billingInterval: BillingInterval =
		subscription && subscription.subscriptionItems && subscription.subscriptionItems[0]?.planPeriod === "annual" ? "annual" : "month";

	// Sort payment attempts by date (most recent first)
	const sortedAttempts = paymentAttempts && paymentAttempts.length > 0 ? [...paymentAttempts].sort((a, b) => 
		new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
	) : [];

	// Handle subscription cancellation
	const handleCancelSubscription = () => {
		if (!subscription?.subscriptionItems?.[0]?.id) {
			toast({
				title: "Error",
				description: "No active subscription found to cancel.",
				variant: "destructive",
			});
			return;
		}

		const confirmed = confirm(
			"Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period."
		);

		if (confirmed) {
			cancelSubscriptionMutation.mutate({
				subscriptionItemId: subscription.subscriptionItems[0].id,
				endNow: false, // Cancel at end of billing period
			});
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status.toLowerCase()) {
			case 'succeeded':
				return (
					<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
						<CheckCircle className="w-3 h-3 mr-1" />
						Paid
					</Badge>
				);
			case 'failed':
				return (
					<Badge variant="destructive">
						<XCircle className="w-3 h-3 mr-1" />
						Failed
					</Badge>
				);
			case 'pending':
				return (
					<Badge variant="secondary">
						<Clock className="w-3 h-3 mr-1" />
						Pending
					</Badge>
				);
			default:
				return (
					<Badge variant="outline">
						{status}
					</Badge>
				);
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const formatAmount = (amount: number, currency = 'USD') => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase(),
		}).format(amount / 100); // Stripe amounts are in cents
	};

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
										<div className="text-2xl font-bold text-foreground">
											Free
										</div>
									) : (
										<div>
											<div className="text-2xl font-bold text-foreground">
												$
												{
													getPricingForInterval(currentPlan, billingInterval)
														.price
												}
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
									<>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="destructive"
														disabled={cancelSubscriptionMutation.isPending || isCanceled}
														onClick={handleCancelSubscription}
													>
														{cancelSubscriptionMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
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
								)}
							</div>
						</CardContent>
					</Card>

					{/* Payment History */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<History className="w-5 h-5" />
								Payment History
							</CardTitle>
						</CardHeader>
						<CardContent>
							{sortedAttempts.length === 0 ? (
								<div className="text-center py-8">
									<History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
									<p className="text-muted-foreground">No payment history available</p>
									<p className="text-sm text-muted-foreground mt-1">
										Payments will appear here once you have an active subscription
									</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Description</TableHead>
												<TableHead>Amount</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Invoice</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{sortedAttempts.map((attempt) => (
												<TableRow key={attempt.id}>
													<TableCell className="font-medium">
														{formatDate(attempt.updatedAt.toISOString())}
													</TableCell>
													<TableCell>
														<div>
															<p className="font-medium">
																{attempt.subscriptionItem.plan.name} Subscription
															</p>
															<p className="text-sm text-muted-foreground">
																{attempt.subscriptionItem.planPeriod === 'annual' ? 'Annual' : 'Monthly'} billing
															</p>
														</div>
													</TableCell>
													<TableCell>
														{formatAmount(attempt.amount.amount, attempt.amount.currency)}
													</TableCell>
													<TableCell>
														{getStatusBadge(attempt.status)}
													</TableCell>
													<TableCell>
														<span className="text-muted-foreground text-sm">—</span>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Failed Payments Alert - only show if there are failed payments */}
					{sortedAttempts.some(attempt => attempt.status === 'failed') && (
						<Card className="border-red-500/40 bg-red-50/50 dark:bg-red-950/20">
							<CardHeader>
								<CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
									<XCircle className="w-5 h-5" />
									Failed Payments
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-red-700 dark:text-red-300 mb-4">
									Some of your recent payments failed. This might affect your service access.
								</p>
								<Button asChild variant="outline" className="border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950">
									<Link href="/billing">
										Update Payment Method
									</Link>
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
			</div>
		</div>
	);
}

function BillingManagementSkeleton() {
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8 max-w-4xl">
				<div className="mb-8">
					<div className="h-8 bg-muted rounded w-64 mb-2" />
					<div className="h-4 bg-muted rounded w-96" />
				</div>
				<div className="grid gap-6">
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
			</div>
		</div>
	);
}

