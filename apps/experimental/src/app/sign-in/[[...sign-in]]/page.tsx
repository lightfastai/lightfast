"use client";
import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useState } from "react";
import { env } from "@/env";

export default function SignInPage() {
	const [usePassword, setUsePassword] = useState(false);

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
							<Clerk.GlobalError className="text-sm text-red-500" />

							<div className="space-y-4">
								{/* Email field - always shown */}
								<Clerk.Field name="identifier" className="space-y-2">
									<Clerk.Input asChild>
										<Input type="email" placeholder="Enter your email" />
									</Clerk.Input>
									<Clerk.FieldError className="text-xs text-red-500" />
								</Clerk.Field>

								{/* Password field - only when usePassword is true */}
								{usePassword && (
									<Clerk.Field name="password" className="space-y-2">
										<Clerk.Input asChild>
											<Input type="password" placeholder="Enter your password" />
										</Clerk.Input>
										<Clerk.FieldError className="text-xs text-red-500" />
									</Clerk.Field>
								)}

								<SignIn.Action submit asChild>
									<Button className="w-full">
										{usePassword ? "Sign In" : "Continue with Email"}
									</Button>
								</SignIn.Action>

								{/* Divider */}
								<div className="relative my-4">
									<div className="absolute inset-0 flex items-center">
										<span className="w-full border-t border-border/50" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-background px-2 text-muted-foreground">
											Or
										</span>
									</div>
								</div>

								{/* Toggle between email and password */}
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => setUsePassword(!usePassword)}
								>
									{usePassword ? "Use Email Verification Instead" : "Sign In with Password"}
								</Button>
							</div>

							{/* Footer */}
							<div className="space-y-2">
								<p className="text-center text-xs text-muted-foreground">
									This platform is invite-only
								</p>
							</div>
						</div>
					</SignIn.Step>

					{/* Email verification step - only for email method */}
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
								<p className="text-center text-sm text-muted-foreground">
									We've sent a verification code to your email
								</p>
								
								<SignIn.Strategy name="email_code">
									<Clerk.Field name="code" className="space-y-2">
										<Clerk.Input asChild>
											<Input type="text" placeholder="Enter verification code" />
										</Clerk.Input>
										<Clerk.FieldError className="text-xs text-red-500" />
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
									className="text-primary hover:text-primary/80 cursor-pointer"
								>
									Resend
								</SignIn.Action>
							</div>
						</div>
					</SignIn.Step>
				</SignIn.Root>
			</div>
		</div>
	);
}
