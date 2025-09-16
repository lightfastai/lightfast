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
					<h3 className="text-sm font-medium">Subscription</h3>
					<p className="text-sm text-muted-foreground">
						{isSubscribed 
							? "Manage your subscription and billing settings" 
							: "Upgrade to unlock premium features"
						}
					</p>
				</div>
				<Button asChild variant="outline" size="sm">
					<Link href={href} className="flex items-center gap-2">
						<CreditCard className="h-4 w-4" />
						{buttonText}
					</Link>
				</Button>
			</div>
		</div>
	);
}