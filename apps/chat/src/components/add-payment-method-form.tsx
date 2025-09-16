"use client";

import { useUser } from "@clerk/nextjs";
import { usePaymentElement, PaymentElement } from "@clerk/nextjs/experimental";
import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/hooks/use-toast";

interface AddPaymentMethodFormProps {
	onSuccess?: () => void;
}

export function AddPaymentMethodForm({ onSuccess }: AddPaymentMethodFormProps) {
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
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message || "An unexpected error occurred.",
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
				<PaymentElement />
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