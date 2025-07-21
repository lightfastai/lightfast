"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md rounded-2xl border bg-background p-8">
				<SignIn.Root>
					<SignIn.Step name="start">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">CODENAME: Experimental</h1>
							</div>

							{/* Form */}
							<Clerk.GlobalError className="text-sm text-red-500" />

							<div className="space-y-4">
								<Clerk.Field name="identifier" className="space-y-2">
									<Clerk.Input asChild>
										<Input type="email" placeholder="Enter your email" />
									</Clerk.Input>
									<Clerk.FieldError className="text-xs text-red-500" />
								</Clerk.Field>

								<SignIn.Action submit asChild>
									<Button className="w-full">Continue with Email</Button>
								</SignIn.Action>
							</div>

							{/* Footer */}
							<p className="text-center text-sm text-muted-foreground">
								Don't have an account?{" "}
								<Link href="/sign-up" className="font-medium text-primary hover:text-primary/80">
									Sign up
								</Link>
							</p>
						</div>
					</SignIn.Step>

					<SignIn.Step name="verifications">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">CODENAME: Experimental</h1>
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
							<div className="text-center">
								<SignIn.Action resend className="text-sm text-primary hover:text-primary/80">
									Didn't receive a code? Resend
								</SignIn.Action>
							</div>
						</div>
					</SignIn.Step>
				</SignIn.Root>
			</div>
		</div>
	);
}
