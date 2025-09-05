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
import { handleClerkError } from "~/app/lib/clerk/error-handler";
import { useLogger } from "@vendor/observability/client-log";

const signUpSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

interface SignUpEmailInputProps {
	onSuccess: (email: string) => void;
	onError: (error: string) => void;
}

export function SignUpEmailInput({
	onSuccess,
	onError,
}: SignUpEmailInputProps) {
	const { signUp, isLoaded } = useSignUp();
	const log = useLogger();

	const form = useForm<SignUpFormData>({
		resolver: zodResolver(signUpSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: SignUpFormData) {
		if (!signUp) return;

		try {
			// Create sign-up attempt with email and password
			await signUp.create({
				emailAddress: data.email,
				password: data.password,
			});

			// Send verification code
			await signUp.prepareEmailAddressVerification({
				strategy: "email_code",
			});

			log.info("[SignUpEmailInput] Authentication success", {
				email: data.email,
				timestamp: new Date().toISOString(),
			});
			onSuccess(data.email);
		} catch (err) {
			// Log the error
			log.error("[SignUpEmailInput] Authentication failed", {
				email: data.email,
				error: err,
			});

			// Handle the error with proper context
			const errorResult = handleClerkError(err, {
				component: "SignUpEmailInput",
				action: "create_sign_up",
				email: data.email,
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
					name="email"
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
							Creating Account...
						</>
					) : (
						"Create Account"
					)}
				</Button>
			</form>
		</Form>
	);
}

