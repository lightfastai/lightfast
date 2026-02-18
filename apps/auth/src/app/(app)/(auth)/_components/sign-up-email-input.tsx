"use client";

import * as React from "react";
import { useSignUp, useClerk } from "@clerk/nextjs";
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
import { consoleUrl } from "~/lib/related-projects";

function navigateToTeamCreation() {
	window.location.href = `${consoleUrl}/account/teams/new`;
}

const emailSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface SignUpEmailInputProps {
	onSuccess: (email: string) => void;
	onError: (error: string, isSignUpRestricted?: boolean) => void;
	invitationTicket?: string | null;
}

export function SignUpEmailInput({
	onSuccess,
	onError,
	invitationTicket,
}: SignUpEmailInputProps) {
	const { signUp, isLoaded } = useSignUp();
	const { setActive } = useClerk();
	const log = useLogger();

	const form = useForm<EmailFormData>({
		resolver: zodResolver(emailSchema),
		defaultValues: {
			email: "",
		},
	});

	async function onSubmit(data: EmailFormData) {
		if (!signUp) return;

		try {
			// If invitation ticket is present, use ticket strategy
			if (invitationTicket) {
				const signUpAttempt = await signUp.create({
					strategy: "ticket",
					ticket: invitationTicket,
					emailAddress: data.email,
				});

				log.info("[SignUpEmailInput] Sign-up created via invitation ticket", {
					email: data.email,
					status: signUpAttempt.status,
				});

				// Ticket strategy auto-verifies email, so check if complete
				if (signUpAttempt.status === "complete") {
					log.info("[SignUpEmailInput] Sign-up complete, redirecting to console");
					await setActive({ session: signUpAttempt.createdSessionId });
					navigateToTeamCreation();
					return;
				}

				const hasEmail = Boolean(signUpAttempt.emailAddress);
				const isVerified = signUpAttempt.verifications.emailAddress.status === "verified";
				if (hasEmail) {
					if (isVerified) {
						log.info("[SignUpEmailInput] Email auto-verified via ticket", {
							email: data.email,
						});
						onSuccess(data.email);
						return;
					}
				}

				// Unexpected state - fall through to standard verification
				log.warn(
					"[SignUpEmailInput] Ticket sign-up did not auto-verify, falling back to code",
					{
						status: signUpAttempt.status,
						emailVerificationStatus:
							signUpAttempt.verifications.emailAddress.status,
					}
				);
			}

			// Standard email-only sign-up flow
			await signUp.create({
				emailAddress: data.email,
			});

			log.info("[SignUpEmailInput] Sign-up created", {
				email: data.email,
			});

			// Send verification code
			await signUp.prepareEmailAddressVerification({
				strategy: "email_code",
			});

			log.info("[SignUpEmailInput] Verification code sent", {
				email: data.email,
			});

			onSuccess(data.email);
		} catch (err) {
			log.error("[SignUpEmailInput] Sign-up failed", {
				email: data.email,
				error: err,
			});

			const errorResult = handleClerkError(err, {
				component: "SignUpEmailInput",
				action: "create_sign_up",
				email: data.email,
			});

			onError(errorResult.userMessage, errorResult.isSignUpRestricted);
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
					size="lg"
					className="w-full"
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
