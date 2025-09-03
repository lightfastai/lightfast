"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import Link from "next/link";

interface RateLimitIndicatorProps {
	remainingMessages: number;
	className?: string;
}

export function RateLimitIndicator({ 
	remainingMessages, 
	className = "" 
}: RateLimitIndicatorProps) {
	// Don't show if user still has plenty of messages
	if (remainingMessages > 7) {
		return null;
	}


	const getAlertVariant = () => {
		if (remainingMessages === 0) return "destructive";
		return "default";
	};

	const getMessage = () => {
		if (remainingMessages === 0) {
			return (
				<span>
					You've reached your daily message limit.{" "}
					<Link href={`/sign-in`} className="underline font-medium hover:no-underline">
						Sign in
					</Link>{" "}
					to continue chatting.
				</span>
			);
		}
		
		if (remainingMessages === 1) {
			return (
				<span>
					You have 1 message remaining.{" "}
					<Link href={`/sign-in`} className="underline font-medium hover:no-underline">
						Sign in
					</Link>{" "}
					to reset your limit.
				</span>
			);
		}

		return (
			<span>
				You have {remainingMessages} messages remaining.{" "}
				<Link href={`/sign-in`} className="underline font-medium hover:no-underline">
					Sign in
				</Link>{" "}
				to reset your limit.
			</span>
		);
	};

	return (
		<div className={`w-full ${className}`}>
			<Alert variant={getAlertVariant()} className="py-2">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription className="text-sm">
					{getMessage()}
				</AlertDescription>
			</Alert>
		</div>
	);
}