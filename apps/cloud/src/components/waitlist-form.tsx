"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { joinWaitlistAction } from "../app/actions/waitlist";
import Link from "next/link";
import { getAppUrl } from "@repo/url-utils";
import { ConfettiWrapper } from "./confetti-wrapper";

function SubmitButton() {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" disabled={pending} className="w-full">
			{pending ? "Joining..." : "Join the waitlist"}
		</Button>
	);
}

export function WaitlistForm() {
	const [state, formAction] = useActionState(joinWaitlistAction, { status: "idle" });
	const wwwUrl = getAppUrl("www");

	if (state.status === "success") {
		return (
			<>
				<ConfettiWrapper />
				<div className="w-full text-center space-y-2">
					<p className="text-sm font-medium">
						You've joined the Lightfast Cloud waitlist!
					</p>
					<p className="text-xs text-muted-foreground">
						We'll send you an invite when we're ready. Check your email for
						updates.
					</p>
				</div>
			</>
		);
	}

	return (
		<div className="w-full space-y-16">
			<form action={formAction} className="w-full flex flex-col gap-2">
				<Input
					type="email"
					name="email"
					placeholder="placeholder@example.com"
					required
					aria-describedby="email-error"
					aria-invalid={state.status === "validation_error" && !!state.fieldErrors.email}
				/>
				{state.status === "validation_error" && state.fieldErrors.email && (
					<p id="email-error" className="text-xs text-destructive">
						{state.fieldErrors.email[0]}
					</p>
				)}
				{state.status === "error" && (
					<p className="text-xs text-destructive">{state.error}</p>
				)}
				<SubmitButton />
			</form>

			<div className="text-xs text-muted-foreground text-center">
				By continuing, you agree to Lightfast's{" "}
				<Link href={`${wwwUrl}/legal/terms`} className="underline">
					Terms of Service
				</Link>{" "}
				and acknowledge our{" "}
				<Link href={`${wwwUrl}/legal/privacy`} className="underline">
					Privacy Policy
				</Link>
				.
			</div>
		</div>
	);
}
