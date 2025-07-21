import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<SignIn
				appearance={{
					elements: {
						rootBox: "mx-auto",
						card: "bg-zinc-900 border-zinc-800",
					},
				}}
			/>
		</div>
	);
}
