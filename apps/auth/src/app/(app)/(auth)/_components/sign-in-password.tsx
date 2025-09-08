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
import { handleClerkError } from "~/app/lib/clerk/error-handler";
import { useLogger } from "@vendor/observability/client-log";

const passwordSchema = z.object({
	identifier: z.string().min(1, "Email or username is required"),
	password: z.string().min(1, "Password is required"),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface SignInPasswordProps {
	onSuccess: () => void;
	onError: (error: string) => void;
}

export function SignInPassword({ onSuccess, onError }: SignInPasswordProps) {
	const { signIn, isLoaded } = useSignIn();
	const log = useLogger();

	const form = useForm<PasswordFormData>({
		resolver: zodResolver(passwordSchema),
		defaultValues: {
			identifier: "",
			password: "",
		},
	});

	async function onSubmit(data: PasswordFormData) {
		if (!signIn) return;

		try {
			// Attempt to sign in with password
			const result = await signIn.create({
				identifier: data.identifier,
				password: data.password,
			});

			if (result.status === "complete") {
				log.info("[SignInPassword] Authentication success", {
					identifier: data.identifier,
					timestamp: new Date().toISOString(),
				});
				onSuccess();
			} else {
				throw new Error("Sign-in incomplete");
			}
		} catch (err) {
			// Log the error
			log.error("[SignInPassword] Authentication failed", {
				identifier: data.identifier,
				error: err,
			});
			
			// Handle the error with proper context
			const errorResult = handleClerkError(err, {
				component: "SignInPassword",
				action: "password_sign_in",
				identifier: data.identifier,
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
					name="identifier"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<Input
									type="text"
									placeholder="Email or username"
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
									placeholder="Password"
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
							Signing in...
						</>
					) : (
						"Sign in with Password"
					)}
				</Button>
			</form>
		</Form>
	);
}