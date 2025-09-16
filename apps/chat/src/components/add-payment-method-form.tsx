"use client";

import { ClerkLoaded } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { usePaymentElement, PaymentElement, PaymentElementProvider } from "@clerk/nextjs/experimental";
import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

interface AddPaymentMethodFormProps {
	onSuccess?: () => void;
}

function AddPaymentMethodFormContent({ onSuccess }: AddPaymentMethodFormProps) {
	const { user } = useUser();
	const { submit, isFormReady } = usePaymentElement();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleAddPaymentMethod = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isFormReady || !user) {
			return;
		}

		setIsSubmitting(true);

		try {
			// 1. Submit the form to the payment provider to get a payment token
			const { data, error } = await submit();

			// Usually a validation error from stripe that you can ignore.
			if (error) {
				setIsSubmitting(false);
				return;
			}

			// 2. Use the token to add the payment source to the user
			await user.addPaymentSource(data);

			// 3. Handle success
			toast({
				title: "Payment Method Added",
				description: "Your payment method has been added successfully.",
			});

			onSuccess?.();
		} catch (err: unknown) {
			toast({
				title: "Error",
				description: err instanceof Error ? err.message : "An unexpected error occurred.",
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleAddPaymentMethod} className="space-y-6">
			<div>
				<h3 className="text-lg font-medium mb-4">Add a new payment method</h3>
				
				{/* Loading skeleton before PaymentElement loads */}
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
			<div className="flex justify-end gap-3">
				<Button
					type="submit"
					disabled={!isFormReady || isSubmitting}
					className="min-w-[120px]"
				>
					{isSubmitting ? "Saving..." : "Save Card"}
				</Button>
			</div>
		</form>
	);
}

export function AddPaymentMethodForm({ onSuccess }: AddPaymentMethodFormProps) {
	return (
		<ClerkLoaded>
			<PaymentElementProvider 
				for="user"
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
			>
				<AddPaymentMethodFormContent onSuccess={onSuccess} />
			</PaymentElementProvider>
		</ClerkLoaded>
	);
}