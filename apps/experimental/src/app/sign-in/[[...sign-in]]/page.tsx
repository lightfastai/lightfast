"use client";
import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { Button } from "@repo/ui/components/ui/button";
import { env } from "@/env";

// Determine auth mode based on environment
const isProduction = env.NEXT_PUBLIC_VERCEL_ENV === "production";
const usePasswordAuth = !isProduction;

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

								{/* Password field for dev/preview */}
								{usePasswordAuth && (
									<Clerk.Field name="password">
										<div className="space-y-2">
											<Clerk.Input type="password" />
											<Clerk.FieldError />
										</div>
									</Clerk.Field>
								)}

								<SignIn.Action submit asChild>
									<Button className="w-full">
										{usePasswordAuth ? "Sign In" : "Continue with Email"}
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

					{/* Email verification step - only for production */}
					{!usePasswordAuth && (
						<SignIn.Step name="verifications">
							<div className="space-y-6">
								{/* Header */}
								<div className="text-center">
									<h1 className="font-mono text-xs tracking-widest text-muted-foreground">
										CODENAME: Experimental
									</h1>
								</div>

								{/* Verification Form */}
								<div className="space-y-4">
									<SignIn.Strategy name="email_code">
										<Clerk.Field name="code">
											<div className="space-y-2">
												<Clerk.Input type="text" />
												<Clerk.FieldError />
											</div>
										</Clerk.Field>

										<SignIn.Action submit asChild>
											<Button className="w-full">Verify Email</Button>
										</SignIn.Action>
									</SignIn.Strategy>
								</div>

								{/* Resend option */}
								<div className="text-center text-sm">
									<span className="text-muted-foreground">
										Didn't receive a code?{" "}
									</span>
									<SignIn.Action
										resend
									>
										Resend
									</SignIn.Action>
								</div>
							</div>
						</SignIn.Step>
					)}
				</SignIn.Root>
			</div>
		</div>
	);
}
