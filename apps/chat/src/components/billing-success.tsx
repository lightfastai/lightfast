"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { 
	CheckCircle, 
	CreditCard, 
	ArrowRight,
	Settings,
	MessageCircle
} from "lucide-react";
import { ClerkPlanKey, BILLING_LIMITS } from "~/lib/billing/types";
import type { BillingInterval } from "~/lib/billing/types";
import { getPlanPricing, getPricingForInterval } from "~/lib/billing/pricing";

export function BillingSuccess() {
	const searchParams = useSearchParams();
	
	// Get plan details from URL params (similar to checkout)
	const planKeyParam = searchParams.get("plan");
	const periodParam = searchParams.get("period");
	const period: BillingInterval = periodParam ? (periodParam as BillingInterval) : "month";
	
	// Validate plan key or fallback to PLUS_TIER (most common success case)
	const planKey = planKeyParam && 
		(Object.values(ClerkPlanKey) as string[]).includes(planKeyParam) 
		? (planKeyParam as ClerkPlanKey) 
		: ClerkPlanKey.PLUS_TIER;

	const planConfig = BILLING_LIMITS[planKey];
	const planPricing = getPlanPricing(planKey);
	const pricing = getPricingForInterval(planKey, period);

	const isUpgrade = planKey !== ClerkPlanKey.FREE_TIER;

	return (
		<div className="min-h-screen bg-background">
			<div className="flex items-center justify-center pt-16 pb-8">
				<div className="space-y-4 max-w-3xl text-center">
					<p className="text-2xs text-muted-foreground font-medium tracking-wide uppercase">
						Lightfast Chat
					</p>
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						{isUpgrade ? "Welcome to Plus" : "Payment Successful"}
					</h1>
					<p className="text-sm max-w-xs text-muted-foreground mx-auto">
						{isUpgrade 
							? "Your subscription has been activated and you now have access to all Plus features"
							: "Your payment has been processed successfully"
						}
					</p>
				</div>
			</div>
			
			<div className="container mx-auto px-4 pb-8 max-w-2xl">
				<div className="space-y-6">
						{/* Plan Summary */}
						<div className="bg-background border rounded-lg p-4">
							<div className="flex items-start justify-between mb-4">
								<div>
									<div className="flex items-center gap-2 mb-1">
										<h3 className="font-semibold text-foreground">{planPricing.name} Plan</h3>
										{isUpgrade && (
											<Badge>
												Active
											</Badge>
										)}
									</div>
									<p className="text-sm text-muted-foreground">
										{period === "annual" ? "Annual billing" : "Monthly billing"}
									</p>
								</div>
								<div className="text-right">
									<div className="font-semibold text-foreground">
										{pricing.price === 0 ? "Free" : `$${pricing.price}`}
									</div>
									{pricing.price > 0 && (
										<div className="text-sm text-muted-foreground">
											{period === "annual" ? "/month (billed annually)" : "/month"}
										</div>
									)}
								</div>
							</div>

							{/* Key Features */}
							<div className="grid md:grid-cols-2 gap-2">
								{isUpgrade ? (
									<>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<MessageCircle className="w-4 h-4 text-blue-600" />
											<span>{planConfig.nonPremiumMessagesPerMonth.toLocaleString()} + {planConfig.premiumMessagesPerMonth} premium messages/month</span>
										</div>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<CheckCircle className="w-4 h-4 text-blue-600" />
											<span>All premium AI models</span>
										</div>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<CheckCircle className="w-4 h-4 text-blue-600" />
											<span>Web search capability</span>
										</div>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<CheckCircle className="w-4 h-4 text-blue-600" />
											<span>Priority support</span>
										</div>
									</>
								) : (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<MessageCircle className="w-4 h-4 text-blue-600" />
										<span>{planConfig.nonPremiumMessagesPerMonth.toLocaleString()} basic messages/month</span>
									</div>
								)}
							</div>
						</div>

						{/* Next Steps */}
						<div className="space-y-3">
							<h4 className="font-medium text-foreground">What's next?</h4>
							
							<div className="grid gap-3">
								<Button asChild className="flex items-center justify-between p-4 h-auto">
									<Link href="/new">
										<div className="flex items-center gap-3">
											<MessageCircle className="w-5 h-5" />
											<div className="text-left">
												<div className="font-medium">Start chatting</div>
												<div className="text-sm opacity-90">
													{isUpgrade ? "Try out premium AI models" : "Begin your conversation"}
												</div>
											</div>
										</div>
										<ArrowRight className="w-5 h-5" />
									</Link>
								</Button>

								<Button asChild variant="outline" className="flex items-center justify-between p-4 h-auto">
									<Link href="/billing">
										<div className="flex items-center gap-3">
											<Settings className="w-5 h-5" />
											<div className="text-left">
												<div className="font-medium">Manage subscription</div>
												<div className="text-sm text-muted-foreground">
													View usage, billing history, and settings
												</div>
											</div>
										</div>
										<ArrowRight className="w-5 h-5" />
									</Link>
								</Button>
							</div>
						</div>

						{/* Billing Info */}
						{isUpgrade && (
							<div className="bg-muted/50 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
									<div className="text-sm">
										<p className="font-medium text-foreground mb-1">Billing Information</p>
										<p className="text-muted-foreground">
											You'll be charged ${pricing.price} {period === "annual" ? "per month (billed annually)" : "monthly"}.
											{period === "annual" && pricing.savings && (
												<span className="text-blue-600 ml-1">
													You're saving {pricing.savings}% with annual billing!
												</span>
											)}
										</p>
										<p className="text-muted-foreground mt-1">
											You can manage your subscription anytime in your billing settings.
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Support */}
						<div className="text-center pt-4 border-t">
							<p className="text-sm text-muted-foreground">
								Need help? Contact our support team for any questions about your subscription.
							</p>
						</div>
				</div>
			</div>
		</div>
	);
}