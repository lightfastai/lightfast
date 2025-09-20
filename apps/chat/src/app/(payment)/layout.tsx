import type { Metadata } from "next";
import type React from "react";
import { LayoutBackButton } from "~/components/layout-back-button";
import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "@repo/ui/components/ui/toaster";

export const metadata: Metadata = {
	title: "Payment - Lightfast Chat",
	description: "Manage your subscription and billing",
	robots: {
		index: false,
		follow: false,
	},
};

interface PaymentLayoutProps {
	children: React.ReactNode;
}

// Layout for payment-related pages (checkout, upgrade, etc.)
// Provides minimal layout with back button header
export default function PaymentLayout({
	children,
}: PaymentLayoutProps) {
	return (
		<TRPCReactProvider>
			<div className="h-screen flex flex-col">
				{/* Header with back button */}
				<div className="absolute top-6 left-6 z-10">
					<LayoutBackButton />
				</div>
				
				{/* Main content */}
				<div className="flex-1">
					{children}
				</div>
			</div>
			<Toaster />
		</TRPCReactProvider>
	);
}