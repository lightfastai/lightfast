"use client";

import * as React from "react";
import { useSignUp } from "@clerk/nextjs";
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

const codeSchema = z.object({
	code: z.string().min(6, "Code must be at least 6 characters"),
});

type CodeFormData = z.infer<typeof codeSchema>;

interface SignUpCodeVerificationProps {
	email: string;
	onReset: () => void;
	onError: (error: string) => void;
}

export function SignUpCodeVerification({
	email,
	onReset,
	onError,
}: SignUpCodeVerificationProps) {
	const { signUp, setActive } = useSignUp();

	const form = useForm<CodeFormData>({
		resolver: zodResolver(codeSchema),
		defaultValues: {
			code: "",
		},
	});

	async function onSubmit(data: CodeFormData) {
		if (!signUp || !setActive) return;

		try {
			// Attempt to verify the code
			const result = await signUp.attemptEmailAddressVerification({
				code: data.code,
			});

			if (result.status === "complete") {
				// Sign-up successful, set the active session
				await setActive({ session: result.createdSessionId });
			}
		} catch (err) {
			console.error("Code verification error:", err);

			if (err instanceof Error) {
				onError(err.message);
			} else if (typeof err === "object" && err !== null && "errors" in err) {
				const clerkError = err as { errors?: { longMessage?: string }[] };
				if (clerkError.errors?.[0]?.longMessage) {
					onError(clerkError.errors[0].longMessage);
				} else {
					onError("Invalid verification code. Please try again.");
				}
			} else {
				onError("Invalid verification code. Please try again.");
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
							"Verify Email"
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