"use client";

import Link from "next/link";
import {
	Card,
	CardContent,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Check, Zap } from "lucide-react";
import { ClerkPlanKey } from "~/lib/billing/types";

interface FreePlanFeaturesSectionProps {
	currentPlan: ClerkPlanKey;
}

const FREE_PLAN_FEATURES = [
	"Chat with Claude on web, iOS, and Android",
	"Write, edit, and create content",
	"Analyze text and upload images",
	"Generate code and visualize data",
	"Get web search results inside chat",
] as const;

export function FreePlanFeaturesSection({ currentPlan }: FreePlanFeaturesSectionProps) {
	// Only show for free tier users
	if (currentPlan !== ClerkPlanKey.FREE_TIER) {
		return null;
	}

	return (
		<Card className="border border-border/40">
			<CardContent className="p-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-4 flex-1">
						<div className="flex-shrink-0 mt-1">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/50">
								<Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
							</div>
						</div>
						<div className="flex-1">
							<div className="mb-4">
								<h3 className="font-semibold text-foreground text-lg mb-1">
									Free plan
								</h3>
								<p className="text-sm text-muted-foreground">
									Try Claude
								</p>
							</div>
							<ul className="space-y-3">
								{FREE_PLAN_FEATURES.map((feature, index) => (
									<li key={index} className="flex items-start gap-3">
										<Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
										<span className="text-sm text-foreground">
											{feature}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
					<div className="flex-shrink-0">
						<Button
							asChild
							variant="outline"
							size="sm"
							className="border-green-500/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/20"
						>
							<Link href="/billing/upgrade">
								Upgrade plan
							</Link>
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}