"use client";

import { Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	getAllPlanPricing,
	getPricingForInterval,
} from "~/lib/billing/pricing";
import type { PlanPricing } from "~/lib/billing/pricing";
import { ClerkPlanKey, getClerkPlanId } from "~/lib/billing/types";
import type { BillingInterval } from "~/lib/billing/types";
import { SignedIn, ClerkLoaded } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface UpgradePlansProps {
	currentPlan: ClerkPlanKey;
}

interface PlusCardProps {
	plan: PlanPricing;
	currentPlan: ClerkPlanKey;
}

function PlusCard({ plan, currentPlan }: PlusCardProps) {
	const [billingInterval, setBillingInterval] =
		useState<BillingInterval>("month");
	const router = useRouter();

	const isCurrentPlan = plan.plan === currentPlan;
	const canUpgrade = !isCurrentPlan;
	const pricing = getPricingForInterval(plan.plan, billingInterval);

	return (
		<Card className="relative transition-all flex flex-col h-full border-green-500/40">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between h-8">
					<CardTitle className="text-xl">{plan.name}</CardTitle>
					<Badge
						variant="secondary"
						className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
					>
						Popular
					</Badge>
				</div>

				{/* Billing Interval Toggle for Plus */}
				<div className="mb-4">
					<Tabs
						value={billingInterval}
						onValueChange={(value) =>
							setBillingInterval(value as BillingInterval)
						}
						className="w-full"
					>
						<TabsList className="grid w-full grid-cols-2 h-8">
							<TabsTrigger value="month" className="text-xs">
								Monthly
							</TabsTrigger>
							<TabsTrigger value="annual" className="text-xs">
								Annual
								<Badge
									variant="secondary"
									className="ml-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs px-1 py-0"
								>
									-20%
								</Badge>
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				<div className="flex items-baseline gap-1 h-12">
					<span className="text-4xl font-bold text-foreground">
						${pricing.price}
					</span>
					<span className="text-muted-foreground">
						{`USD / month${billingInterval === "annual" ? " (billed annually)" : ""}`}
					</span>
				</div>
				<CardDescription className="text-sm text-foreground h-10 flex items-start">
					{plan.description}
				</CardDescription>
			</CardHeader>

			<CardContent className="pb-4 flex-grow">
				<div className="space-y-1">
					{plan.features.map((feature: string, index: number) => (
						<div key={index} className="flex items-center gap-3">
							<Check className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-600" />
							<span className="text-xs text-foreground leading-relaxed">
								{feature}
							</span>
						</div>
					))}
				</div>
			</CardContent>

			<CardFooter className="mt-auto">
				{isCurrentPlan ? (
					<Button variant="secondary" className="w-full" disabled>
						Your current plan
					</Button>
				) : canUpgrade ? (
					<ClerkLoaded>
						<SignedIn>
							<CheckoutButton
								planId={getClerkPlanId(plan.plan)}
								planPeriod={billingInterval}
								for="user"
								onSubscriptionComplete={() => {
									router.back();
								}}
							>
								<Button className="w-full bg-green-600 hover:bg-green-700 text-white">
									{currentPlan === ClerkPlanKey.FREE_TIER
										? `Upgrade to ${plan.name}${billingInterval === "annual" ? " Annual" : ""}`
										: `Get ${plan.name}${billingInterval === "annual" ? " Annual" : ""}`}
								</Button>
							</CheckoutButton>
						</SignedIn>
					</ClerkLoaded>
				) : null}
			</CardFooter>
		</Card>
	);
}

export function UpgradePlans({ currentPlan }: UpgradePlansProps) {
	const router = useRouter();

	// Only get Free and Plus plans
	const allPlans = getAllPlanPricing();
	const pricingPlans = allPlans.filter((plan) =>
		[ClerkPlanKey.FREE_TIER, ClerkPlanKey.PLUS_TIER].includes(plan.plan),
	);

	return (
		<div className="h-screen max-h-screen bg-background flex items-center justify-center">
			<div className="w-full max-w-4xl">
				{/* Main content */}
				<div className="text-center mb-8">
					<h1 className="text-3xl font-semibold mb-6 text-foreground">
						Upgrade your plan
					</h1>

					{/* Tabs */}
					<Tabs defaultValue="Personal" className="w-fit mx-auto mb-8">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="Personal">Personal</TabsTrigger>
							<TabsTrigger value="Business" disabled>
								Business
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{/* Pricing cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
					{pricingPlans.map((plan) => {
						const isPlus = plan.plan === ClerkPlanKey.PLUS_TIER;
						const isFree = plan.plan === ClerkPlanKey.FREE_TIER;
						const isCurrentPlan = plan.plan === currentPlan;
						const canUpgrade = !isCurrentPlan;

						// Render Plus card with billing toggle
						if (isPlus) {
							return (
								<PlusCard
									key={plan.plan}
									plan={plan}
									currentPlan={currentPlan}
								/>
							);
						}

						// Render Free card normally (no billing options)
						const pricing = getPricingForInterval(plan.plan, "month");

						return (
							<Card
								key={plan.plan}
								className="relative transition-all flex flex-col h-full border-border/50 hover:border-border"
							>
								<CardHeader className="pb-4">
									<div className="flex items-center justify-between h-8">
										<CardTitle className="text-xl">{plan.name}</CardTitle>
										<div></div>
									</div>
									<div className="flex items-baseline gap-1 h-12">
										<span className="text-4xl font-bold text-foreground">
											${pricing.price}
										</span>
										<span className="text-muted-foreground">
											{pricing.price === 0 ? "" : "USD / month"}
										</span>
									</div>
									<CardDescription className="text-sm text-foreground h-10 flex items-start">
										{plan.description}
									</CardDescription>
								</CardHeader>

								<CardContent className="pb-4 flex-grow">
									<div className="space-y-1">
										{plan.features.map((feature, index) => (
											<div key={index} className="flex items-center gap-3">
												<Check className="h-3 w-3 mt-0.5 flex-shrink-0 text-foreground" />
												<span className="text-xs text-foreground leading-relaxed">
													{feature}
												</span>
											</div>
										))}
									</div>
								</CardContent>

								<CardFooter className="mt-auto">
									{isCurrentPlan ? (
										<Button variant="secondary" className="w-full" disabled>
											Your current plan
										</Button>
									) : canUpgrade && !isFree ? (
										<ClerkLoaded>
											<SignedIn>
												<CheckoutButton
													planId={getClerkPlanId(plan.plan)}
													planPeriod="month"
													for="user"
													onSubscriptionComplete={() => {
														// Go back to where user came from
														router.back();
													}}
												>
													<Button className="w-full bg-green-600 hover:bg-green-700 text-white">
														{isFree
															? `Get ${plan.name}`
															: `Downgrade to ${plan.name}`}
													</Button>
												</CheckoutButton>
											</SignedIn>
										</ClerkLoaded>
									) : null}
								</CardFooter>
							</Card>
						);
					})}
				</div>
			</div>
		</div>
	);
}
