import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BillingManagement } from "~/components/billing-management";
import { auth } from "@clerk/nextjs/server";
import { ClerkPlanKey, hasClerkPlan } from "@repo/chat-billing";
import { HydrateClient, prefetch, trpc } from "@repo/chat-trpc/server";
import { BillingContentSkeleton } from "~/components/billing-content-skeleton";

// Force dynamic rendering due to auth usage
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
	const { has } = await auth();

	// Check current user's subscription plan using type-safe helper
	const hasPlusPlan = hasClerkPlan(has, ClerkPlanKey.PLUS_TIER);

	// Redirect free users to upgrade page
	if (!hasPlusPlan) {
		redirect("/billing/upgrade");
	}

	// User has plus plan, proceed with billing management
	const currentPlan: ClerkPlanKey = ClerkPlanKey.PLUS_TIER;

	// Prefetch billing data on the server for instant loading
	prefetch(trpc.billing.getSubscription.queryOptions());

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8 max-w-4xl">
				{/* Static Header - renders immediately */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Billing & Subscription
					</h1>
					<p className="text-muted-foreground">
						Manage your subscription, usage, and billing preferences
					</p>
				</div>

				{/* Dynamic Content - shows loading skeleton */}
				<HydrateClient>
					<Suspense fallback={<BillingContentSkeleton />}>
						<BillingManagement currentPlan={currentPlan} />
					</Suspense>
				</HydrateClient>
			</div>
		</div>
	);
}