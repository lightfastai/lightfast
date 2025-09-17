"use client";

import { Button } from "@repo/ui/components/ui/button";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { useBillingContext } from "~/hooks/use-billing-context";

export function BillingTab() {
	const billingContext = useBillingContext();
	const { capabilities } = {
		capabilities: billingContext.plan.capabilities,
	};

	const isSubscribed = capabilities.isPlusUser;
	const href = isSubscribed ? "/billing" : "/upgrade";
	const buttonText = isSubscribed ? "Manage Account" : "Upgrade";

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-xs font-medium">Subscription</h3>
				</div>
				<Button asChild variant="outline" className="h-8 text-xs px-3">
					<Link href={href} className="flex items-center gap-2">
						<CreditCard className="h-3 w-3" />
						{buttonText}
					</Link>
				</Button>
			</div>
		</div>
	);
}