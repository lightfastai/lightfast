"use client";
import * as Clerk from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export function SignUpForm() {
	return (
		<SignUp.Root>
			<SignUp.Step name="start">
				<div className="space-y-6">
					{/* Header */}
					<div className="text-center">
						<h1 className="text-lg font-bold text-foreground">
							Sign up for Lightfast
						</h1>
					</div>

					{/* Form */}
					<Clerk.GlobalError className="text-sm text-red-500" />

					<div className="space-y-4 mt-8">
						{/* Email field */}
						<Clerk.Field name="emailAddress" className="space-y-2">
							<Clerk.Input asChild>
								<Input type="email" placeholder="Enter your email" />
							</Clerk.Input>
							<Clerk.FieldError className="text-xs text-red-500" />
						</Clerk.Field>

						<SignUp.Action submit asChild>
							<Button className="w-full">Sign up with Email</Button>
						</SignUp.Action>

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

						{/* Social Authentication */}
						<div className="space-y-3">
							<Clerk.Connection name="github" asChild>
								<Button variant="outline" className="w-full">
									<svg
										className="w-4 h-4 mr-2"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
									</svg>
									Sign up with GitHub
								</Button>
							</Clerk.Connection>

							<Clerk.Connection name="google" asChild>
								<Button variant="outline" className="w-full">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 17 16"
										className="w-4 h-4 mr-2"
										aria-hidden
									>
										<path
											fill="currentColor"
											d="M8.82 7.28v2.187h5.227c-.16 1.226-.57 2.124-1.192 2.755-.764.765-1.955 1.6-4.035 1.6-3.218 0-5.733-2.595-5.733-5.813 0-3.218 2.515-5.814 5.733-5.814 1.733 0 3.005.685 3.938 1.565l1.538-1.538C12.998.96 11.256 0 8.82 0 4.41 0 .705 3.591.705 8s3.706 8 8.115 8c2.382 0 4.178-.782 5.582-2.24 1.44-1.44 1.893-3.475 1.893-5.111 0-.507-.035-.978-.115-1.369H8.82Z"
										/>
									</svg>
									Sign up with Google
								</Button>
							</Clerk.Connection>
						</div>
					</div>

					{/* Sign In Link */}
					<div className="text-center text-sm">
						<span className="text-muted-foreground">
							Already have an account?{" "}
						</span>
						<a
							href="/sign-in"
							className="text-primary hover:text-primary/80 underline"
						>
							Sign in
						</a>
					</div>
				</div>
			</SignUp.Step>

			{/* Email verification step */}
			<SignUp.Step name="verifications">
				<div className="space-y-6">
					{/* Header */}
					<div className="text-center">
						<div className="flex flex-col gap-1">
							<h1 className="text-base font-bold text-foreground">
								Verify Your Email
							</h1>
							<p className="text-xs text-muted-foreground">
								We've sent a verification code to your email
							</p>
						</div>
					</div>

					{/* Verification Form */}
					<div className="space-y-4 mt-8">
						<SignUp.Strategy name="email_code">
							<Clerk.Field name="code" className="space-y-2">
								<Clerk.Input asChild>
									<Input
										type="text"
										placeholder="Enter verification code"
									/>
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
						<span className="text-muted-foreground">
							Didn't receive a code?{" "}
						</span>
						<SignUp.Action
							resend
							className="text-primary hover:text-primary/80 cursor-pointer underline"
						>
							Resend
						</SignUp.Action>
					</div>
				</div>
			</SignUp.Step>
		</SignUp.Root>
	);
}