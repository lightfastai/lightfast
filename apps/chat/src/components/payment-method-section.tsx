"use client";

import * as React from "react";
import { usePaymentMethods } from "@clerk/nextjs/experimental";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { CreditCard } from "lucide-react";
import { ClerkPlanKey } from "~/lib/billing/types";
import { UpdatePaymentMethodDialog } from "./update-payment-method-dialog";

interface PaymentMethodSectionProps {
	currentPlan: ClerkPlanKey;
}

export function PaymentMethodSection({ currentPlan }: PaymentMethodSectionProps) {
	const {
		data: paymentMethods,
		isLoading,
		error,
	} = usePaymentMethods();

	// Only show for paid plans
	if (currentPlan === ClerkPlanKey.FREE_TIER) {
		return null;
	}

	// Handle loading state
	if (isLoading) {
		return <PaymentMethodSectionSkeleton />;
	}

	// Handle error state
	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CreditCard className="w-5 h-5" />
						Payment
					</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">
						{String(error?.message || "Failed to load payment methods")}
					</p>
				</CardContent>
			</Card>
		);
	}

	// Get the primary payment method (usually the first one)
	const primaryPaymentMethod = paymentMethods?.[0];

	// Format card brand
	const formatCardBrand = (brand: string | undefined): string => {
		if (!brand) return "Card";
		return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
	};

	// Format last 4 digits
	const formatLast4 = (last4: string | undefined): string => {
		if (!last4) return "••••";
		return `•••• ${last4}`;
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CreditCard className="w-5 h-5" />
					Payment
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<CreditCard className="w-5 h-5 text-muted-foreground" />
						<div>
							{primaryPaymentMethod ? (
								<span className="text-foreground">
									{formatCardBrand(primaryPaymentMethod.brand)} {formatLast4(primaryPaymentMethod.last4)}
								</span>
							) : (
								<span className="text-muted-foreground">
									No payment method on file
								</span>
							)}
						</div>
					</div>
					<UpdatePaymentMethodDialog
						trigger={
							<Button variant="outline" size="sm">
								{primaryPaymentMethod ? "Update" : "Add"}
							</Button>
						}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function PaymentMethodSectionSkeleton() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CreditCard className="w-5 h-5" />
					Payment
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-5 h-5 bg-muted rounded" />
						<div className="h-4 bg-muted rounded w-32" />
					</div>
					<div className="h-9 bg-muted rounded w-16" />
				</div>
			</CardContent>
		</Card>
	);
}