"use client";
import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { env } from "../../../env";

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
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">Lightfast Auth</h1>
							</div>

							{/* Form */}
							<Clerk.GlobalError className="text-sm text-red-500" />

							<div className="space-y-4">
								{/* Social Authentication */}
								<div className="space-y-3">
									<Clerk.Connection name="github" asChild>
										<Button variant="outline" className="w-full">
											<svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
												<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
											</svg>
											Continue with GitHub
										</Button>
									</Clerk.Connection>

									<Clerk.Connection name="google" asChild>
										<Button variant="outline" className="w-full">
											<svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
												<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
												<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
												<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
												<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
											</svg>
											Continue with Google
										</Button>
									</Clerk.Connection>
								</div>

								{/* Divider */}
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<span className="w-full border-t border-border/50" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
									</div>
								</div>

								{/* Email Authentication */}
								<Clerk.Field name="identifier" className="space-y-2">
									<Clerk.Input asChild>
										<Input type="email" placeholder="Enter your email" />
									</Clerk.Input>
									<Clerk.FieldError className="text-xs text-red-500" />
								</Clerk.Field>

								{/* Password field for dev/preview */}
								{usePasswordAuth && (
									<Clerk.Field name="password" className="space-y-2">
										<Clerk.Input asChild>
											<Input type="password" placeholder="Enter your password" />
										</Clerk.Input>
										<Clerk.FieldError className="text-xs text-red-500" />
									</Clerk.Field>
								)}

								<SignIn.Action submit asChild>
									<Button className="w-full">{usePasswordAuth ? "Sign In" : "Continue with Email"}</Button>
								</SignIn.Action>
							</div>

							{/* Footer */}
							<div className="space-y-2">
								<p className="text-center text-xs text-muted-foreground">Authentication powered by Clerk</p>
							</div>
						</div>
					</SignIn.Step>

					{/* Email verification step - only for production */}
					{!usePasswordAuth && (
						<SignIn.Step name="verifications">
							<div className="space-y-6">
								{/* Header */}
								<div className="text-center">
									<h1 className="font-mono text-xs tracking-widest text-muted-foreground">Lightfast Auth</h1>
								</div>

								{/* Verification Form */}
								<div className="space-y-4">
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
									<span className="text-muted-foreground">Didn't receive a code? </span>
									<SignIn.Action resend className="text-primary hover:text-primary/80 cursor-pointer">
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