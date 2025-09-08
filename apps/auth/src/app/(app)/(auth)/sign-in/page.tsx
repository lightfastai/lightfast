import { SignInForm } from "../_components/sign-in-form";
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