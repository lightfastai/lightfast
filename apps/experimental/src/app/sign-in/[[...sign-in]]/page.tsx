"use client";
import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { Button } from "@repo/ui/components/ui/button";
import { env } from "@/env";

export default function SignInPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md rounded-2xl border border-border/50 bg-background p-8">
				<SignIn.Root>
					<SignIn.Step name="start">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">
									CODENAME: Experimental
								</h1>
							</div>

							{/* Form */}
							<Clerk.GlobalError />

							<div className="space-y-4">
								<Clerk.Field name="identifier">
									<div className="space-y-2">
										<Clerk.Input type="text" />
										<Clerk.FieldError />
									</div>
								</Clerk.Field>

								{/* Password field */}
								<Clerk.Field name="password">
									<div className="space-y-2">
										<Clerk.Input type="password" />
										<Clerk.FieldError />
									</div>
								</Clerk.Field>

								<SignIn.Action submit asChild>
									<Button className="w-full">
										Sign In
									</Button>
								</SignIn.Action>
							</div>

							{/* Footer */}
							<div className="space-y-2">
								<p className="text-center text-xs text-muted-foreground">
									This platform is invite-only
								</p>
							</div>
						</div>
					</SignIn.Step>
				</SignIn.Root>
			</div>
		</div>
	);
}
