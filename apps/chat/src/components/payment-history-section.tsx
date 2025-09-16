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
import { CheckCircle, History, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

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
					<CardTitle>
						Invoices
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

	const getStatusBadge = (status: string, isOverdue = false) => {
		if (isOverdue) {
			return (
				<Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
					<AlertTriangle className="w-3 h-3 mr-1" />
					Overdue
				</Badge>
			);
		}

		switch (status.toLowerCase()) {
			case "succeeded":
				return (
					<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
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

	const formatAmount = (amount: number, currency = "AUD") => {
		return new Intl.NumberFormat("en-AU", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount / 100); // Stripe amounts are in cents
	};

	const isInvoiceOverdue = (attempt: any) => {
		// You can implement your overdue logic here
		// For now, we'll simulate some overdue invoices based on status
		return attempt.status.toLowerCase() === "failed" || 
			   (attempt.status.toLowerCase() === "pending" && 
			    new Date().getTime() - new Date(attempt.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000); // 7 days
	};

	const handlePayClick = (attemptId: string) => {
		// Placeholder for pay functionality
		console.log("Pay clicked for attempt:", attemptId);
	};

	const handleViewClick = (attemptId: string) => {
		// Placeholder for view functionality
		console.log("View clicked for attempt:", attemptId);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					Invoices
				</CardTitle>
			</CardHeader>
			<CardContent>
				{sortedAttempts.length === 0 ? (
					<div className="text-center py-8">
						<History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
						<p className="text-muted-foreground">
							No invoices available
						</p>
						<p className="text-sm text-muted-foreground mt-1">
							Invoices will appear here once you have an active subscription
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Total</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedAttempts.map((attempt) => {
									const isOverdue = isInvoiceOverdue(attempt);
									const isPaid = attempt.status.toLowerCase() === "succeeded";
									
									return (
										<TableRow key={attempt.id}>
											<TableCell className="font-medium">
												{formatDate(attempt.updatedAt.toISOString())}
											</TableCell>
											<TableCell>
												{formatAmount(
													attempt.amount.amount,
													attempt.amount.currency,
												)}
											</TableCell>
											<TableCell>
												{getStatusBadge(attempt.status, isOverdue)}
											</TableCell>
											<TableCell>
												{isOverdue ? (
													<Button
														variant="default"
														size="sm"
														onClick={() => handlePayClick(attempt.id)}
													>
														Pay
													</Button>
												) : isPaid ? (
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleViewClick(attempt.id)}
													>
														View
													</Button>
												) : (
													<Button
														variant="outline"
														size="sm"
														disabled
													>
														Pending
													</Button>
												)}
											</TableCell>
										</TableRow>
									);
								})}
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

