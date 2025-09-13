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
import { getAllPlanPricing } from "~/lib/billing/pricing";
import type { BillingPlan } from "~/lib/billing";
import { getClerkPlanId } from "~/lib/billing/types";
import { SignedIn, ClerkLoaded } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { useRouter } from "next/navigation";

export function UpgradePlans() {
	const router = useRouter();
	
	// Only get Free and Plus plans
	const allPlans = getAllPlanPricing();
	const pricingPlans = allPlans.filter((plan) =>
		["free", "plus"].includes(plan.plan),
	);

	return (
		<div className="h-screen max-h-screen bg-background flex items-center justify-center p-6">
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
							<TabsTrigger value="Business" disabled>Business</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{/* Pricing cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
					{pricingPlans.map((plan) => {
						const isPlus = plan.plan === "plus";
						const isFree = plan.plan === "free";

						return (
							<Card
								key={plan.plan}
								className={`relative transition-all ${
									isPlus
										? "border-green-500 bg-green-50/30 dark:bg-green-950/20"
										: "border-border/50 hover:border-border"
								}`}
							>
								<CardHeader className="pb-4">
									<div className="flex items-center justify-between">
										<CardTitle className="text-xl">{plan.name}</CardTitle>
										{isPlus && (
											<Badge
												variant="secondary"
												className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
											>
												Popular
											</Badge>
										)}
									</div>
									<div className="flex items-baseline gap-1">
										<span className="text-4xl font-bold text-foreground">
											${plan.price}
										</span>
										<span className="text-muted-foreground">
											{plan.price === 0 ? "" : `USD / ${plan.interval}`}
										</span>
									</div>
									<CardDescription className="text-sm">
										{plan.description}
									</CardDescription>
								</CardHeader>

								<CardContent className="pb-4">
									<div className="space-y-3">
										{plan.features.map((feature, index) => (
											<div key={index} className="flex items-start gap-3">
												<Check
													className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
														isPlus ? "text-green-600" : "text-foreground"
													}`}
												/>
												<span className="text-sm text-foreground leading-relaxed">
													{feature}
												</span>
											</div>
										))}
									</div>
								</CardContent>

								<CardFooter>
									{isFree ? (
										<Button variant="secondary" className="w-full" disabled>
											Your current plan
										</Button>
									) : (
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
														Get {plan.name}
													</Button>
												</CheckoutButton>
											</SignedIn>
										</ClerkLoaded>
									)}
								</CardFooter>
							</Card>
						);
					})}
				</div>

			</div>
		</div>
	);
}

