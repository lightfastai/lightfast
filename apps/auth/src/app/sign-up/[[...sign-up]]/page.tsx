"use client";
import * as Clerk from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { env } from "../../../env";

// Determine auth mode based on environment
const isProduction = env.NEXT_PUBLIC_VERCEL_ENV === "production";
const usePasswordAuth = !isProduction;

export default function SignUpPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md rounded-2xl border border-border/50 bg-background p-8">
				<SignUp.Root>
					<SignUp.Step name="start">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">Create Your Account</h1>
							</div>

							{/* Form */}
							<Clerk.GlobalError className="text-sm text-red-500" />

							<div className="space-y-4">
								<Clerk.Field name="emailAddress" className="space-y-2">
									<Clerk.Input asChild>
										<Input type="email" placeholder="Enter your email" />
									</Clerk.Input>
									<Clerk.FieldError className="text-xs text-red-500" />
								</Clerk.Field>

								{/* Password fields for dev/preview */}
								{usePasswordAuth && (
									<>
										<Clerk.Field name="password" className="space-y-2">
											<Clerk.Input asChild>
												<Input type="password" placeholder="Create a password" />
											</Clerk.Input>
											<Clerk.FieldError className="text-xs text-red-500" />
										</Clerk.Field>
									</>
								)}

								<SignUp.Action submit asChild>
									<Button className="w-full">{usePasswordAuth ? "Sign Up" : "Continue with Email"}</Button>
								</SignUp.Action>
							</div>

							{/* Sign In Link */}
							<div className="text-center text-sm">
								<span className="text-muted-foreground">Already have an account? </span>
								<a href="/sign-in" className="text-primary hover:text-primary/80">
									Sign in
								</a>
							</div>
						</div>
					</SignUp.Step>

					{/* Email verification step - only for production */}
					{!usePasswordAuth && (
						<SignUp.Step name="verifications">
							<div className="space-y-6">
								{/* Header */}
								<div className="text-center">
									<h1 className="font-mono text-xs tracking-widest text-muted-foreground">Verify Your Email</h1>
								</div>

								{/* Verification Form */}
								<div className="space-y-4">
									<SignUp.Strategy name="email_code">
										<Clerk.Field name="code" className="space-y-2">
											<Clerk.Input asChild>
												<Input type="text" placeholder="Enter verification code" />
											</Clerk.Input>
											<Clerk.FieldError className="text-xs text-red-500" />
										</Clerk.Field>

										<SignUp.Action submit asChild>
											<Button className="w-full">Verify Email</Button>
										</SignUp.Action>
									</SignUp.Strategy>
								</div>

								{/* Resend option */}
								<div className="text-center text-sm">
									<span className="text-muted-foreground">Didn't receive a code? </span>
									<SignUp.Action resend className="text-primary hover:text-primary/80 cursor-pointer">
										Resend
									</SignUp.Action>
								</div>
							</div>
						</SignUp.Step>
					)}
				</SignUp.Root>
			</div>
		</div>
	);
}