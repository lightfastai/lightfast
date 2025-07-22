import * as Clerk from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/env";

// Block sign-up in production
const isProduction = env.NEXT_PUBLIC_VERCEL_ENV === "production";

export default function SignUpPage() {
	// Redirect to sign-in if in production
	if (isProduction) {
		redirect("/sign-in");
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md rounded-2xl border border-border/50 bg-background p-8">
				<SignUp.Root>
					<SignUp.Step name="start">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">CODENAME: Experimental</h1>
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

								<Clerk.Field name="password" className="space-y-2">
									<Clerk.Input asChild>
										<Input type="password" placeholder="Create a password" />
									</Clerk.Input>
									<Clerk.FieldError className="text-xs text-red-500" />
								</Clerk.Field>

								<SignUp.Action submit asChild>
									<Button className="w-full">Create Account</Button>
								</SignUp.Action>
							</div>

							{/* Footer */}
							<div className="space-y-2">
								<p className="text-center text-xs text-muted-foreground">
									Already have an account?{" "}
									<Link href="/sign-in" className="text-primary hover:text-primary/80">
										Sign in
									</Link>
								</p>
								<p className="text-center text-xs text-muted-foreground/60">
									Note: Sign-up is only available in development/preview
								</p>
							</div>
						</div>
					</SignUp.Step>

					{/* Verification step if needed */}
					<SignUp.Step name="verifications">
						<div className="space-y-6">
							{/* Header */}
							<div className="text-center">
								<h1 className="font-mono text-xs tracking-widest text-muted-foreground">CODENAME: Experimental</h1>
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
						</div>
					</SignUp.Step>
				</SignUp.Root>
			</div>
		</div>
	);
}

