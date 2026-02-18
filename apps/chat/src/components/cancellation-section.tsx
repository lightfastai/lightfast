"use client";

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
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ClerkPlanKey } from "@repo/chat-billing";
import { useTRPC } from "@repo/chat-trpc/react";
import { useBillingData } from "~/hooks/use-billing-data";

interface CancellationSectionProps {
	currentPlan: ClerkPlanKey;
}

export function CancellationSection({ currentPlan }: CancellationSectionProps) {
	const trpc = useTRPC();
	const {
		hasActiveSubscription,
		isCanceled,
		refreshSubscription,
		revalidatePayments,
		billingInterval,
		activePaidItem,
	} = useBillingData();
	const router = useRouter();

	const cancelSubscriptionMutation = useMutation(
		trpc.billing.cancelSubscriptionItem.mutationOptions({
			onSuccess: () => {
				void refreshSubscription();
				void revalidatePayments();
				toast({
					title: "Subscription Cancelled",
					description:
						"Your subscription has been cancelled successfully. You'll continue to have access until the end of your billing period.",
				});
				router.push(
					`/billing/cancelled?plan=${currentPlan}&period=${billingInterval}`,
				);
			},
			onError: (error: unknown) => {
				toast({
					title: "Error",
					description:
						(error instanceof Error ? error.message : null) ?? "Failed to cancel subscription. Please try again.",
					variant: "destructive",
				});
			},
		}),
	);

	if (currentPlan === ClerkPlanKey.FREE_TIER || !hasActiveSubscription || isCanceled) {
		return null;
	}

	const handleCancelSubscription = () => {
		if (!activePaidItem?.id) {
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
				subscriptionItemId: activePaidItem.id,
				endNow: false, // Cancel at end of billing period
			});
		}
	};

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
									disabled={cancelSubscriptionMutation.isPending}
									onClick={handleCancelSubscription}
								>
									{cancelSubscriptionMutation.isPending
										? "Cancelling..."
										: "Cancel plan"}
								</Button>
							</TooltipTrigger>
						</Tooltip>
					</TooltipProvider>
				</div>
			</CardContent>
		</Card>
	);
}
