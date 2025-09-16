"use client";
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { usePaymentAttempts } from "@clerk/nextjs/experimental";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { XCircle } from "lucide-react";
import { UpdatePaymentMethodDialog } from "./update-payment-method-dialog";

interface _PaymentAttempt {
	status: string;
	updatedAt: string;
	[key: string]: unknown;
}

export function FailedPaymentsAlert() {
	const {
		data: paymentAttempts,
		isLoading: attemptsLoading,
		error: attemptsError,
	} = usePaymentAttempts();

	// Don't render if still loading or there's an error
	if (attemptsLoading || attemptsError) {
		return null;
	}
	// Sort payment attempts by date (most recent first)
	const sortedAttempts = paymentAttempts?.length 
		? [...paymentAttempts].sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			)
		: [];

	// Only show if there are failed payments
	if (!sortedAttempts.some((attempt) => attempt.status === "failed")) {
		return null;
	}

	return (
		<Card className="border-red-500/40 bg-red-50/50 dark:bg-red-950/20">
			<CardHeader>
				<CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
					<XCircle className="w-5 h-5" />
					Failed Payments
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-red-700 dark:text-red-300 mb-4">
					Some of your recent payments failed. This might affect your
					service access.
				</p>
				<UpdatePaymentMethodDialog>
					<Button
						variant="outline"
						className="border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
					>
						Update Payment Method
					</Button>
				</UpdatePaymentMethodDialog>
			</CardContent>
		</Card>
	);
}