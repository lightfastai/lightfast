"use client";

/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ClerkPlanKey } from "~/lib/billing/types";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

interface CancellationSectionProps {
	currentPlan: ClerkPlanKey;
}

export function CancellationSection({ currentPlan }: CancellationSectionProps) {
	const trpc = useTRPC();
	
	const { data: subscriptionData } = useSuspenseQuery({
		...trpc.billing.getSubscription.queryOptions(),
		staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
		refetchOnMount: false, // Prevent blocking navigation
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});
	
	// Extract subscription state from query data
	const {
		hasActiveSubscription = false,
		isCanceled = false,
		billingInterval = "month" as const,
		paidSubscriptionItems = [],
	} = subscriptionData;
	const router = useRouter();

	// Only show for paid plans
	if (currentPlan === ClerkPlanKey.FREE_TIER) {
		return null;
	}

	// Cancel subscription mutation
	const cancelSubscriptionMutation = useMutation(
		trpc.billing.cancelSubscriptionItem.mutationOptions({
			onSuccess: () => {
				toast({
					title: "Subscription Cancelled",
					description:
						"Your subscription has been cancelled successfully. You'll continue to have access until the end of your billing period.",
				});
				// TODO: Add revalidation logic if needed
				// Redirect to cancellation confirmation page with plan context
				router.push(
					`/billing/cancelled?plan=${currentPlan}&period=${billingInterval}`,
				);
			},
			onError: (error: unknown) => {
				toast({
					title: "Error",
					description:
						(error instanceof Error ? error.message : null) || "Failed to cancel subscription. Please try again.",
					variant: "destructive",
				});
			},
		}),
	);

	// Handle subscription cancellation
	const handleCancelSubscription = () => {
		if (!paidSubscriptionItems?.[0]?.id) {
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
				subscriptionItemId: paidSubscriptionItems[0]!.id,
				endNow: false, // Cancel at end of billing period
			});
		}
	};

	// Don't render if there's no active subscription or if already canceled
	if (!hasActiveSubscription || isCanceled) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cancellation</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">
						Cancel your subscription at any time. You'll continue to have access until the end of your current billing period.
					</p>
				</div>

				<div className="pt-2">
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
										: "Cancel plan"}
								</Button>
							</TooltipTrigger>
							{isCanceled && (
								<TooltipContent>
									<p>Your plan has already been cancelled</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				</div>
			</CardContent>
		</Card>
	);
}