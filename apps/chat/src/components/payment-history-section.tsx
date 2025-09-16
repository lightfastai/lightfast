"use client";

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import * as React from "react";
import { usePaymentAttempts } from "@clerk/nextjs/experimental";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/ui/table";
import { CheckCircle, History, XCircle, Clock } from "lucide-react";

export function PaymentHistorySection() {
	const { data: paymentAttempts, isLoading, error } = usePaymentAttempts();

	// Handle loading state
	if (isLoading) {
		return <PaymentHistorySectionSkeleton />;
	}

	// Handle error state
	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<History className="w-5 h-5" />
						Payment History
					</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">
						{String(error?.message || "Failed to load payment history")}
					</p>
				</CardContent>
			</Card>
		);
	}

	// Sort payment attempts by date (most recent first)
	const sortedAttempts = paymentAttempts?.length
		? [...paymentAttempts].sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			)
		: [];

	const getStatusBadge = (status: string) => {
		switch (status.toLowerCase()) {
			case "succeeded":
				return (
					<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
						<CheckCircle className="w-3 h-3 mr-1" />
						Paid
					</Badge>
				);
			case "failed":
				return (
					<Badge variant="destructive">
						<XCircle className="w-3 h-3 mr-1" />
						Failed
					</Badge>
				);
			case "pending":
				return (
					<Badge variant="secondary">
						<Clock className="w-3 h-3 mr-1" />
						Pending
					</Badge>
				);
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const formatAmount = (amount: number, currency = "USD") => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount / 100); // Stripe amounts are in cents
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<History className="w-5 h-5" />
					Payment History
				</CardTitle>
			</CardHeader>
			<CardContent>
				{sortedAttempts.length === 0 ? (
					<div className="text-center py-8">
						<History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
						<p className="text-muted-foreground">
							No payment history available
						</p>
						<p className="text-sm text-muted-foreground mt-1">
							Payments will appear here once you have an active subscription
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedAttempts.map((attempt) => (
									<TableRow key={attempt.id}>
										<TableCell className="font-medium">
											{formatDate(attempt.updatedAt.toISOString())}
										</TableCell>
										<TableCell>
											<div>
												<p className="text-sm text-muted-foreground">
													{attempt.subscriptionItem.planPeriod === "annual"
														? "Annual"
														: "Monthly"}{" "}
													billing
												</p>
											</div>
										</TableCell>
										<TableCell>
											{formatAmount(
												attempt.amount.amount,
												attempt.amount.currency,
											)}
										</TableCell>
										<TableCell>{getStatusBadge(attempt.status)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PaymentHistorySectionSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="h-6 bg-muted rounded w-32" />
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					<div className="h-4 bg-muted rounded w-full" />
					<div className="h-4 bg-muted rounded w-3/4" />
					<div className="h-4 bg-muted rounded w-1/2" />
				</div>
			</CardContent>
		</Card>
	);
}

