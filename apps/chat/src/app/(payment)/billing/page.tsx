import { BillingManagement } from "~/components/billing-management";
import { auth } from "@clerk/nextjs/server";
import { ClerkPlanKey, hasClerkPlan } from "~/lib/billing/types";

export default async function BillingPage() {
	const { has } = await auth();

	// Check current user's subscription plan using type-safe helper
	const hasPlusPlan = hasClerkPlan(has, ClerkPlanKey.PLUS_TIER);

	// Determine current plan (defaults to free if no active subscription)
	const currentPlan: ClerkPlanKey = hasPlusPlan ? ClerkPlanKey.PLUS_TIER : ClerkPlanKey.FREE_TIER;

	return <BillingManagement currentPlan={currentPlan} />;
}