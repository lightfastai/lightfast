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
import { handleClerkError } from "~/services/clerk-error-handler.service";
import { useLogger } from "@vendor/observability/client-log";

const emailSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface SignInEmailInputProps {
	onSuccess: (email: string) => void;
	onError: (error: string) => void;
}

export function SignInEmailInput({ onSuccess, onError }: SignInEmailInputProps) {
	const { signIn, isLoaded } = useSignIn();
	const log = useLogger();

	const form = useForm<EmailFormData>({
		resolver: zodResolver(emailSchema),
		defaultValues: {
			email: "",
		},
	});

	async function onSubmit(data: EmailFormData) {
		if (!signIn) return;

		try {
			// Create sign-in attempt with email
			await signIn.create({
				identifier: data.email,
			});

			// Send verification code
			const emailFactor = signIn.supportedFirstFactors?.find(
				(factor) => factor.strategy === "email_code",
			);

			if (!emailFactor?.emailAddressId) {
				throw new Error("Email verification is not supported");
			}

			await signIn.prepareFirstFactor({
				strategy: "email_code",
				emailAddressId: emailFactor.emailAddressId,
			});

			log.info("[SignInEmailInput] Authentication success", {
				email: data.email,
				timestamp: new Date().toISOString(),
			});
			onSuccess(data.email);
		} catch (err) {
			// Log the error
			log.error("[SignInEmailInput] Authentication failed", {
				email: data.email,
				error: err,
			});
			
			// Handle the error with proper context
			const errorResult = handleClerkError(err, {
				component: "SignInEmailInput",
				action: "create_sign_in",
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

				<Button
					type="submit"
					className="w-full h-12"
					disabled={!isLoaded || form.formState.isSubmitting}
				>
					{form.formState.isSubmitting ? (
						<>
							<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
							Sending...
						</>
					) : (
						"Continue with Email"
					)}
				</Button>
			</form>
		</Form>
	);
}

