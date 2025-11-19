"use client";

import { useEffect } from "react";

/**
 * GitHub OAuth Callback for Popup Flow
 *
 * This page is loaded in the popup window after GitHub OAuth completes.
 * It sends a success message to the parent window and closes itself.
 *
 * Flow:
 * 1. GitHub redirects here after OAuth
 * 2. This page sends "github-oauth-success" message to parent
 * 3. Parent updates UI from disconnected → connected
 * 4. Popup closes itself
 */
export default function AuthCallbackPage() {
	useEffect(() => {
		// Send success message to parent window
		if (window.opener) {
			window.opener.postMessage(
				{
					type: "github-oauth-success",
				},
				window.location.origin,
			);

			// Close popup after short delay to ensure message is received
			setTimeout(() => {
				window.close();
			}, 500);
		} else {
			// Fallback: if opened directly (not popup), redirect to /new
			window.location.href = "/new";
		}
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="text-center">
				<h1 className="text-2xl font-semibold mb-2">Connected!</h1>
				<p className="text-muted-foreground">Redirecting back...</p>
			</div>
		</div>
	);
}
