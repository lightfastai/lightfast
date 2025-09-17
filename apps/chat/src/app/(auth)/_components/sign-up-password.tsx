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
import { handleClerkError } from "~/services/clerk-error-handler.service";
import { useLogger } from "@vendor/observability/client-log";

const passwordSchema = z.object({
	emailAddress: z.string().email("Please enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters long"),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface SignUpPasswordProps {
	onSuccess: (email: string) => void;
	onError: (error: string) => void;
}

export function SignUpPassword({ onSuccess, onError }: SignUpPasswordProps) {
	const { signUp, isLoaded } = useSignUp();
	const log = useLogger();

	const form = useForm<PasswordFormData>({
		resolver: zodResolver(passwordSchema),
		defaultValues: {
			emailAddress: "",
			password: "",
		},
	});

	async function onSubmit(data: PasswordFormData) {
		if (!signUp) return;

		try {
			// Create sign-up attempt with password
			await signUp.create({
				emailAddress: data.emailAddress,
				password: data.password,
			});

			// Send verification code to email
			await signUp.prepareEmailAddressVerification({
				strategy: "email_code",
			});

			log.info("[SignUpPassword] Sign-up created, verification code sent", {
				email: data.emailAddress,
				timestamp: new Date().toISOString(),
			});

			onSuccess(data.emailAddress);
		} catch (err) {
			// Log the error
			log.error("[SignUpPassword] Sign-up failed", {
				email: data.emailAddress,
				error: err,
			});
			
			// Handle the error with proper context
			const errorResult = handleClerkError(err, {
				component: "SignUpPassword",
				action: "password_sign_up",
				email: data.emailAddress,
			});
			
			// Pass the user-friendly error message to parent
			onError(errorResult.userMessage);
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="emailAddress"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<Input
									type="email"
									placeholder="Email Address"
									className="h-12 bg-background dark:bg-background"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<Input
									type="password"
									placeholder="Password (8+ characters)"
									className="h-12 bg-background dark:bg-background"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button
					type="submit"
					className="w-full h-12"
					disabled={!isLoaded || form.formState.isSubmitting}
				>
					{form.formState.isSubmitting ? (
						<>
							<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
							Creating account...
						</>
					) : (
						"Create Account with Password"
					)}
				</Button>
			</form>
		</Form>
	);
}