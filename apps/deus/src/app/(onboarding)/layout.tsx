import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";

/**
 * Onboarding Layout
 *
 * Wraps onboarding pages with authentication check that treats pending sessions as signed-in.
 * This allows users who have authenticated but not completed tasks (like claiming an org)
 * to access the onboarding flow.
 *
 * Flow:
 * - Pending sessions (authenticated, no org): See onboarding content
 * - Active sessions (authenticated, has org): See onboarding content (can claim additional orgs)
 * - Unauthenticated users: Redirected to sign-in page
 *
 * IMPORTANT: Both SignedIn and SignedOut must use treatPendingAsSignedOut={false}
 * to prevent infinite redirect loops with pending sessions.
 */
export default function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="dark">
			<SignedIn treatPendingAsSignedOut={false}>{children}</SignedIn>
			<SignedOut treatPendingAsSignedOut={false}>
				<RedirectToSignIn />
			</SignedOut>
		</div>
	);
}
