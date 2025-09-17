"use client";
import * as React from "react";
import { SignedIn, ClerkLoaded } from "@clerk/nextjs";
import {
	CheckoutProvider,
	useCheckout,
	PaymentElementProvider,
	PaymentElement,
	usePaymentElement,
} from "@clerk/nextjs/experimental";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { ArrowLeft, CreditCard, Shield, Zap } from "lucide-react";
import { ClerkPlanKey, getClerkPlanId } from "~/lib/billing/types";
import type { BillingInterval } from "~/lib/billing/types";
import { getPricingForInterval, getCheckoutFeatures } from "~/lib/billing/pricing";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

interface CheckoutPlanProps {
	currentPlan: ClerkPlanKey;
}

export function CheckoutPlan({ currentPlan }: CheckoutPlanProps) {
	const searchParams = useSearchParams();
	const router = useRouter();

	// Get plan details from URL params
	const planKeyParam = searchParams.get("plan");
	const periodParam = searchParams.get("period");
	const period: BillingInterval = periodParam ? (periodParam as BillingInterval) : "month";

	// Validate plan key
	if (
		!planKeyParam ||
		!(Object.values(ClerkPlanKey) as string[]).includes(planKeyParam)
	) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle className="text-center text-destructive">
							Invalid Plan
						</CardTitle>
					</CardHeader>
					<CardContent className="text-center space-y-4">
						<p className="text-muted-foreground">
							The selected plan is not valid.
						</p>
						<p className="text-xs text-muted-foreground">
							Received: {planKeyParam ?? "null"} | Expected:{" "}
							{Object.values(ClerkPlanKey).join(", ")}
						</p>
						<Button onClick={() => router.push("/billing/upgrade")} variant="outline">
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back to Plans
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const planKey = planKeyParam as ClerkPlanKey;

	// Check if user already has this plan - but allow cancelled users to proceed
	if (currentPlan === planKey) {
		return <SubscriptionCheck planKey={planKey} currentPlan={currentPlan} />;
	}

	const planId = getClerkPlanId(planKey);

	return (
		<div className="min-h-screen bg-background">
			<CheckoutProvider for="user" planId={planId} planPeriod={period}>
				<ClerkLoaded>
					<SignedIn>
						<CustomCheckout planKey={planKey} period={period} />
					</SignedIn>
				</ClerkLoaded>
			</CheckoutProvider>
		</div>
	);
}

function CustomCheckout({
	planKey,
	period,
}: {
	planKey: ClerkPlanKey;
	period: BillingInterval;
}) {
	const { checkout } = useCheckout();
	const { status } = checkout;

	if (status === "needs_initialization") {
		return <CheckoutInitialization />;
	}

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-foreground mb-2">
					Complete Your Purchase
				</h1>
				<p className="text-muted-foreground">
					Secure checkout powered by Stripe
				</p>
			</div>

			<div className="grid lg:grid-cols-2 gap-8">
				{/* Order Summary */}
				<div className="order-2 lg:order-1">
					<CheckoutSummary planKey={planKey} period={period} />
				</div>

				{/* Payment Form */}
				<div className="order-1 lg:order-2">
					<PaymentElementProvider
						checkout={checkout}
						stripeAppearance={{
							colorPrimary: "#b4b4b4", // --primary (oklch 0.7058 0 0)
							colorBackground: "#383838", // --background (oklch 0.2178 0 0)
							colorText: "#e2e2e2", // --foreground (oklch 0.8853 0 0)
							colorTextSecondary: "#999999", // --muted-foreground (oklch 0.5999 0 0)
							colorDanger: "#ef4444", // --destructive (oklch 0.6591 0.153 22.1703)
							colorSuccess: "#b4b4b4", // Using primary for success
							colorWarning: "#a1a1aa", // --chart-2 (oklch 0.6714 0.0339 206.3482)
							fontWeightNormal: "400",
							fontWeightMedium: "500",
							fontWeightBold: "600",
							fontSizeXl: "20px",
							fontSizeLg: "16px",
							fontSizeSm: "14px",
							fontSizeXs: "12px",
							borderRadius: "6px",
							spacingUnit: "4px",
						}}
						paymentDescription={`${planKey === ClerkPlanKey.PLUS_TIER ? "Plus" : "Free"} Plan - ${period === "annual" ? "Annual" : "Monthly"} Billing`}
					>
						<PaymentSection />
					</PaymentElementProvider>
				</div>
			</div>
		</div>
	);
}

function CheckoutInitialization() {
	const { checkout } = useCheckout();
	const { start, status, fetchStatus } = checkout;

	if (status !== "needs_initialization") {
		return null;
	}

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-center">Initialize Checkout</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">
						Ready to start your checkout process?
					</p>
					<Button
						onClick={start}
						disabled={fetchStatus === "fetching"}
						className="w-full"
					>
						{fetchStatus === "fetching" ? (
							<>
								<div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Initializing...
							</>
						) : (
							<>
								<CreditCard className="w-4 h-4 mr-2" />
								Start Checkout
							</>
						)}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function PaymentSection() {
	const { checkout } = useCheckout();
	const { isConfirming, confirm, finalize, error } = checkout;
	const { isFormReady, submit } = usePaymentElement();
	const [isProcessing, setIsProcessing] = React.useState(false);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!isFormReady || isProcessing) return;
		setIsProcessing(true);

		try {
			// Submit payment form to get payment method
			const { data, error: submitError } = await submit();

			// Handle validation errors from Stripe
			if (submitError) {
				console.error("Payment form validation error:", submitError);
				return;
			}

			// Confirm checkout with payment method
			await confirm(data);

			// Complete checkout and redirect to new success page
			finalize({ 
				navigate: () => {
					const params = new URLSearchParams(window.location.search);
					const plan = params.get("plan");
					const period = params.get("period");
					
					const successParams = new URLSearchParams();
					if (plan) successParams.set("plan", plan);
					if (period) successParams.set("period", period);
					
					router.push(`/billing/success?${successParams.toString()}`);
				}
			});
		} catch (error) {
			console.error("Payment failed:", error);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CreditCard className="w-5 h-5" />
					Payment Information
				</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Payment Element */}
					<div className="space-y-4">
						{!isFormReady && (
							<div className="space-y-3">
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
							</div>
						)}
						<PaymentElement
							fallback={
								<div className="space-y-3">
									<Skeleton className="h-12 w-full" />
									<Skeleton className="h-12 w-full" />
									<Skeleton className="h-12 w-full" />
								</div>
							}
						/>
					</div>

					{/* Security Notice */}
					<div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
						<Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
						<div className="text-sm">
							<p className="font-medium text-foreground">Secure Payment</p>
							<p className="text-muted-foreground">
								Your payment information is encrypted and processed securely by
								Stripe.
							</p>
						</div>
					</div>

					{/* Error Display */}
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error.message}</AlertDescription>
						</Alert>
					)}

					{/* Submit Button */}
					<Button
						type="submit"
						disabled={!isFormReady || isProcessing || isConfirming}
						className="w-full"
						size="lg"
					>
						{isProcessing || isConfirming ? (
							<>
								<div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Processing...
							</>
						) : (
							<>
								<Zap className="w-4 h-4 mr-2" />
								Complete Purchase
							</>
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function CheckoutSummary({
	planKey,
	period,
}: {
	planKey: ClerkPlanKey;
	period: BillingInterval;
}) {
	const { checkout } = useCheckout();
	const { plan, totals } = checkout;

	// Get local pricing data as fallback
	const localPricing = getPricingForInterval(planKey, period);

	// Use Clerk data if available, otherwise fallback to local data
	const planName =
		plan?.name ?? (planKey === ClerkPlanKey.PLUS_TIER ? "Plus" : "Free");
	
	// Handle pricing display with proper fallbacks
	let displayPrice = `${localPricing.price}`;
	let currency = "$";
	
	if (totals?.totalDueNow) {
		displayPrice = totals.totalDueNow.amountFormatted;
		currency = totals.totalDueNow.currencySymbol;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Order Summary</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Plan Details */}
				<div className="flex justify-between items-start">
					<div>
						<h3 className="font-medium text-foreground">{planName} Plan</h3>
						<p className="text-sm text-muted-foreground">
							{period === "annual" ? "Annual billing" : "Monthly billing"}
						</p>
					</div>
					<div className="text-right">
						<div className="font-semibold text-foreground">
							{currency}
							{displayPrice}
						</div>
						<div className="text-sm text-muted-foreground">
							{period === "annual" ? "/year" : "/month"}
						</div>
					</div>
				</div>

				{/* Features */}
				<div className="border-t pt-4">
					<h4 className="font-medium text-foreground mb-3">What's included:</h4>
					<div className="space-y-2">
						{getCheckoutFeatures(planKey).map((feature, index) => (
							<div key={index} className="text-sm text-muted-foreground">
								{feature}
							</div>
						))}
					</div>
				</div>

				{/* Total */}
				<div className="border-t pt-4">
					<div className="flex justify-between items-center text-lg font-semibold">
						<span>Total</span>
						<span>
							{currency}
							{displayPrice}
						</span>
					</div>
					{period === "annual" && (
						<p className="text-sm text-green-600 text-right mt-1">
							Save 20% with annual billing
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function SubscriptionCheck({ 
	planKey, 
	currentPlan: _currentPlan 
}: { 
	planKey: ClerkPlanKey; 
	currentPlan: ClerkPlanKey; 
}) {
	const trpc = useTRPC();
	
	const { data: subscriptionData } = useSuspenseQuery({
		...trpc.billing.getSubscription.queryOptions(),
		staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
		refetchOnMount: false, // Prevent blocking navigation
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});
	
	const { isCanceled = false } = subscriptionData;
	const router = useRouter();
	const searchParams = useSearchParams();
	
	// If user has cancelled their subscription, allow them to proceed to checkout
	if (isCanceled) {
		const period = searchParams.get("period") ?? "month";
		const planId = getClerkPlanId(planKey);
		
		return (
			<div className="min-h-screen bg-background">
				<CheckoutProvider for="user" planId={planId} planPeriod={period as BillingInterval}>
					<ClerkLoaded>
						<SignedIn>
							<CustomCheckout planKey={planKey} period={period as BillingInterval} />
						</SignedIn>
					</ClerkLoaded>
				</CheckoutProvider>
			</div>
		);
	}

	// If subscription is active and not cancelled, show "Already Subscribed" message
	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-center">Already Subscribed</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">
						You already have the{" "}
						{planKey === ClerkPlanKey.PLUS_TIER ? "Plus" : "Free"} plan.
					</p>
					<Button onClick={() => router.push("/billing/upgrade")} variant="outline">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Back to Plans
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

