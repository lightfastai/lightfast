"use client";

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { Icons } from "@repo/ui/components/icons";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface CodeVerificationUIProps {
	email: string;
	code: string;
	onCodeChange: (value: string) => void;
	isVerifying: boolean;
	isRedirecting: boolean;
	isResending: boolean;
	inlineError: string | null;
	onResend: () => void;
	onReset: () => void;
	title?: string;
}

export function CodeVerificationUI({
	email,
	code,
	onCodeChange,
	isVerifying,
	isRedirecting,
	isResending,
	inlineError,
	onResend,
	onReset,
	title = "Verification",
}: CodeVerificationUIProps) {
	return (
		<div className="w-full space-y-8">
			{/* Header - matches sign-in/sign-up styling */}
			<div className="text-center">
				<h1 className="text-3xl font-semibold text-foreground">{title}</h1>
				<p className="text-sm text-muted-foreground mt-2">
					{email ? (
						<>
							We sent a verification code to{" "}
							<span className="font-medium">{email}</span>
						</>
					) : (
						"Enter the verification code from your email"
					)}
				</p>
			</div>

			<div className="space-y-4">
				<div className="flex flex-col items-center space-y-4">
					<InputOTP
						value={code}
						onChange={onCodeChange}
						maxLength={6}
						disabled={isVerifying || isRedirecting}
						aria-invalid={!!inlineError}
						containerClassName="gap-2"
					>
						<InputOTPGroup className="gap-2">
							<InputOTPSlot
								index={0}
								className="!rounded-none border first:!rounded-none dark:bg-transparent"
							/>
							<InputOTPSlot
								index={1}
								className="!rounded-none border dark:bg-transparent"
							/>
							<InputOTPSlot
								index={2}
								className="!rounded-none border dark:bg-transparent"
							/>
							<InputOTPSlot
								index={3}
								className="!rounded-none border dark:bg-transparent"
							/>
							<InputOTPSlot
								index={4}
								className="!rounded-none border dark:bg-transparent"
							/>
							<InputOTPSlot
								index={5}
								className="!rounded-none border last:!rounded-none dark:bg-transparent"
							/>
						</InputOTPGroup>
					</InputOTP>

					{/* Inline error message */}
					{inlineError && (
						<div className="flex items-center gap-2 text-sm text-destructive">
							<AlertCircle className="h-4 w-4" />
							<span>{inlineError}</span>
						</div>
					)}

					{/* Loading state */}
					{(isVerifying || isRedirecting) && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Icons.spinner className="h-4 w-4 animate-spin" />
							<span>{isRedirecting ? "Redirecting..." : "Verifying..."}</span>
						</div>
					)}
				</div>

				{/* Back button */}
				<Button
					onClick={onReset}
					disabled={isVerifying || isRedirecting}
					variant="link-blue"
					size="lg"
					className="w-full rounded-none"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</Button>

				{/* Resend code */}
				<div className="text-center text-sm text-muted-foreground">
					Didn't receive your code?{" "}
					<Button
						onClick={onResend}
						disabled={isResending || isVerifying || isRedirecting}
						variant="link-blue"
						className="inline-flex h-auto p-0 rounded-none"
					>
						{isResending && <Icons.spinner className="h-3 w-3 animate-spin" />}
						Resend
					</Button>
				</div>
			</div>
		</div>
	);
}

