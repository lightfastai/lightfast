import { SignInForm } from "~/app/components/auth/sign-in-form";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";

export default function SignInPage() {
	return (
		<>
			<SignedOut>
				<RedirectToTasks />
			</SignedOut>
			<SignInForm />
		</>
	);
}