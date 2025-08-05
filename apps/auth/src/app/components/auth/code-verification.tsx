"use client";

import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { Icons } from "@repo/ui/components/icons";
import { getErrorMessage, formatErrorForLogging, isAccountLockedError, formatLockoutTime } from "~/app/lib/clerk/error-handling";
import { useLogger } from '@vendor/observability/client-log';

const codeSchema = z.object({
	code: z.string().min(6, "Code must be at least 6 characters"),
});

type CodeFormData = z.infer<typeof codeSchema>;

interface CodeVerificationProps {
	email: string;
	onReset: () => void;
	onError: (error: string) => void;
}

export function CodeVerification({
	email,
	onReset,
	onError,
}: CodeVerificationProps) {
	const { signIn, setActive } = useSignIn();
	const log = useLogger();

	const form = useForm<CodeFormData>({
		resolver: zodResolver(codeSchema),
		defaultValues: {
			code: "",
		},
	});

	async function onSubmit(data: CodeFormData) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!signIn || !setActive) return;

		try {
			// Attempt to verify the code
			const result = await signIn.attemptFirstFactor({
				strategy: "email_code",
				code: data.code,
			});

			if (result.status === "complete") {
				// Sign-in successful, set the active session
				await setActive({ session: result.createdSessionId });
				log.info('[CodeVerification.onSubmit] Authentication success', { 
					email, 
					sessionId: result.createdSessionId,
					timestamp: new Date().toISOString()
				});
			}
		} catch (err) {
			log.error('[CodeVerification.onSubmit] Authentication error', formatErrorForLogging('CodeVerification.onSubmit', err));
			
			// Check for account lockout
			const lockoutInfo = isAccountLockedError(err);
			if (lockoutInfo.locked && lockoutInfo.expiresInSeconds) {
				onError(`Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`);
			} else {
				onError(getErrorMessage(err));
			}

			form.reset();
		}
	}

	return (
		<div className="space-y-4">
			<div className="text-center">
				<p className="text-sm text-muted-foreground">
					We sent a verification code to {email}
				</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="code"
						render={({ field }) => (
							<FormItem>
								<FormControl>
									<Input
										type="text"
										placeholder="Enter verification code"
										autoFocus
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
					>
						{form.formState.isSubmitting ? (
							<>
								<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
								Verifying...
							</>
						) : (
							"Verify Code"
						)}
					</Button>
				</form>
			</Form>

			<Button onClick={onReset} variant="ghost" className="w-full text-sm">
				Use a different email
			</Button>
		</div>
	);
}

