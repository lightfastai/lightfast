"use client";

import { useState } from "react";
import { ClerkLoaded } from "@clerk/nextjs";
import { PaymentElementProvider } from "@clerk/nextjs/experimental";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { CreditCard } from "lucide-react";
import { AddPaymentMethodForm } from "./add-payment-method-form";

interface UpdatePaymentMethodDialogProps {
	trigger?: React.ReactNode;
	children?: React.ReactNode;
}

export function UpdatePaymentMethodDialog({
	trigger,
	children,
}: UpdatePaymentMethodDialogProps) {
	const [open, setOpen] = useState(false);

	const handleSuccess = () => {
		setOpen(false);
	};

	const defaultTrigger = (
		<Button variant="outline" className="flex items-center gap-2">
			<CreditCard className="w-4 h-4" />
			Update Payment Method
		</Button>
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || children || defaultTrigger}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Update Payment Method</DialogTitle>
				</DialogHeader>
				<ClerkLoaded>
					<PaymentElementProvider for="user">
						<AddPaymentMethodForm onSuccess={handleSuccess} />
					</PaymentElementProvider>
				</ClerkLoaded>
			</DialogContent>
		</Dialog>
	);
}