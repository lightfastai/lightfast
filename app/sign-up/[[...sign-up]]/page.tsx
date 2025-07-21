"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import Link from "next/link";

export default function SignUpPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md">
				<SignUp.Root>
					<SignUp.Step name="start">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="text-2xl font-semibold text-foreground">Create an account</h1>
								<p className="mt-2 text-sm text-muted-foreground">Get started with your free account</p>
							</div>

							{/* Form */}
							<Clerk.GlobalError className="text-sm text-red-500" />

							<div className="space-y-4">
								<Clerk.Field name="emailAddress" className="space-y-2">
									<Clerk.Label className="text-sm font-medium text-foreground">Email address</Clerk.Label>
									<Clerk.Input
										type="email"
										className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
										placeholder="Enter your email"
									/>
									<Clerk.FieldError className="text-xs text-red-500" />
								</Clerk.Field>

								<SignUp.Action
									submit
									className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
								>
									Continue with Email
								</SignUp.Action>
							</div>

							{/* Footer */}
							<p className="text-center text-sm text-muted-foreground">
								Already have an account?{" "}
								<Link href="/sign-in" className="font-medium text-blue-600 hover:text-blue-500">
									Sign in
								</Link>
							</p>
						</div>
					</SignUp.Step>

					<SignUp.Step name="verifications">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="text-2xl font-semibold text-foreground">Verify your email</h1>
								<p className="mt-2 text-sm text-muted-foreground">We sent a verification code to your email</p>
							</div>

							{/* Verification Form */}
							<div className="space-y-4">
								<SignUp.Strategy name="email_code">
									<Clerk.Field name="code" className="space-y-2">
										<Clerk.Label className="text-sm font-medium text-foreground">Verification code</Clerk.Label>
										<Clerk.Input
											type="text"
											className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
											placeholder="Enter verification code"
										/>
										<Clerk.FieldError className="text-xs text-red-500" />
									</Clerk.Field>

									<SignUp.Action
										submit
										className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
									>
										Verify Email
									</SignUp.Action>
								</SignUp.Strategy>
							</div>

							{/* Resend option */}
							<div className="text-center">
								<SignUp.Action resend className="text-sm text-blue-600 hover:text-blue-500">
									Didn't receive a code? Resend
								</SignUp.Action>
							</div>
						</div>
					</SignUp.Step>
				</SignUp.Root>
			</div>
		</div>
	);
}
