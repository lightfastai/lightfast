"use client";

import Link from "next/link";
import {
	Card,
	CardContent,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ClerkPlanKey } from "~/lib/billing/types";

interface UpgradePromptProps {
	currentPlan: ClerkPlanKey;
}

export function UpgradePrompt({ currentPlan }: UpgradePromptProps) {
	// Only show for free tier users
	if (currentPlan !== ClerkPlanKey.FREE_TIER) {
		return null;
	}

	return (
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
	);
}