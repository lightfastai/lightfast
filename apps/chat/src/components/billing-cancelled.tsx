"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
	Calendar,
	ArrowRight,
	RotateCcw,
	MessageCircle,
} from "lucide-react";
import { ClerkPlanKey } from "@repo/chat-billing";
import { getPlanPricing } from "@repo/chat-billing/pricing";

export function BillingCancelled() {
	const searchParams = useSearchParams();
	
	// Get plan details from URL params (similar to billing-success)
	const planKeyParam = searchParams.get("plan");
	
	// Validate plan key or fallback to Plus (most likely for cancellation)
	const planKey = planKeyParam && 
		(Object.values(ClerkPlanKey) as string[]).includes(planKeyParam) 
		? (planKeyParam as ClerkPlanKey) 
		: ClerkPlanKey.PLUS_TIER;

	const planPricing = getPlanPricing(planKey);
	const isPlusUser = planKey === ClerkPlanKey.PLUS_TIER;
	
	return (
		<div className="min-h-screen bg-background">
			<div className="flex items-center justify-center pt-16 pb-8">
				<div className="space-y-4 max-w-3xl text-center">
					<p className="text-2xs text-muted-foreground font-medium tracking-wide uppercase">
						Lightfast Chat
					</p>
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						Subscription Cancelled
					</h1>
					<p className="text-sm max-w-xs text-muted-foreground mx-auto">
						Your {planPricing.name} subscription has been cancelled successfully
					</p>
				</div>
			</div>

			<div className="container mx-auto px-4 pb-8 max-w-2xl">
				<div className="space-y-6">
					{/* Current Access Period */}
					<div className="bg-background border rounded-lg p-4">
						<div className="flex items-start gap-3">
							<Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
							<div>
								<p className="font-medium text-foreground mb-1">
									Access Period
								</p>
								<p className="text-sm text-muted-foreground">
									{isPlusUser ? (
										<>
											You'll keep your Plus features until your current billing
											period ends. After that, you'll be automatically moved to the
											Free plan.
										</>
									) : (
										<>
											Your subscription cancellation has been processed. You will retain
											your current plan features until the end of your billing period.
										</>
									)}
								</p>
								<p className="text-sm text-muted-foreground mt-2">
									<strong>Note:</strong> The exact end date will be shown in
									your billing management once the cancellation is fully
									processed.
								</p>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="space-y-3">
						<h4 className="font-medium text-foreground">
							What would you like to do?
						</h4>

						<div className="grid gap-3">
							<Button
								asChild
								className="flex items-center justify-between p-4 h-auto"
							>
								<Link href="/billing">
									<div className="flex items-center gap-3">
										<RotateCcw className="w-5 h-5" />
										<div className="text-left">
											<div className="font-medium">Reactivate subscription</div>
											<div className="text-sm opacity-90">
												Resume your {planPricing.name} plan anytime
											</div>
										</div>
									</div>
									<ArrowRight className="w-5 h-5" />
								</Link>
							</Button>

							<Button
								asChild
								variant="outline"
								className="flex items-center justify-between p-4 h-auto"
							>
								<Link href="/new">
									<div className="flex items-center gap-3">
										<MessageCircle className="w-5 h-5" />
										<div className="text-left">
											<div className="font-medium">Continue chatting</div>
											<div className="text-sm text-muted-foreground">
												{isPlusUser 
													? "Use your remaining Plus features"
													: `Use your remaining ${planPricing.name} features`
												}
											</div>
										</div>
									</div>
									<ArrowRight className="w-5 h-5" />
								</Link>
							</Button>
						</div>
					</div>

					{/* Feedback Section */}
					<div className="bg-muted/50 rounded-lg p-4">
						<h4 className="font-medium text-foreground mb-2">
							Help us improve
						</h4>
						<p className="text-sm text-muted-foreground mb-3">
							We're sorry to see you go. Your feedback helps us make Lightfast
							Chat better for everyone.
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								// This could open a feedback modal or redirect to a feedback form
								// For now, we'll use a simple mailto link
								window.location.href =
									"mailto:support@lightfast.ai?subject=Subscription Cancellation Feedback";
							}}
						>
							Share feedback
						</Button>
					</div>

					{/* Support */}
					<div className="text-center pt-4 border-t">
						<p className="text-sm text-muted-foreground">
							Have questions about your cancellation? Contact our support team
							for assistance.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
