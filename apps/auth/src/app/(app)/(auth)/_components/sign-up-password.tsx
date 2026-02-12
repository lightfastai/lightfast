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

const signUpPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpPasswordFormData = z.infer<typeof signUpPasswordSchema>;

interface SignUpPasswordProps {
	onSuccess: (email: string) => void;
	onError: (error: string) => void;
}

export function SignUpPassword({ onSuccess, onError }: SignUpPasswordProps) {
	const { signUp, isLoaded } = useSignUp();
	const log = useLogger();

	const form = useForm<SignUpPasswordFormData>({
		resolver: zodResolver(signUpPasswordSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: SignUpPasswordFormData) {
		if (!signUp) return;

		try {
			await signUp.create({
				emailAddress: data.email,
				password: data.password,
			});

			log.info("[SignUpPassword] Sign-up created", {
				email: data.email,
			});

			await signUp.prepareEmailAddressVerification({
				strategy: "email_code",
			});

			log.info("[SignUpPassword] Verification code sent", {
				email: data.email,
			});

			onSuccess(data.email);
		} catch (err) {
			log.error("[SignUpPassword] Sign-up failed", {
				email: data.email,
				error: err,
			});

			const errorResult = handleClerkError(err, {
				component: "SignUpPassword",
				action: "create_sign_up",
				email: data.email,
			});

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
					size="lg"
					className="w-full"
					disabled={!isLoaded || form.formState.isSubmitting}
				>
					{form.formState.isSubmitting ? (
						<>
							<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
							Creating Account...
						</>
					) : (
						"Sign up with Password"
					)}
				</Button>
			</form>
		</Form>
	);
}
