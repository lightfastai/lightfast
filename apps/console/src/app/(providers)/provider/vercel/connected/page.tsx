"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Vercel OAuth Success Page
 *
 * Displayed in popup window after successful Vercel OAuth authorization.
 * Shows confirmation message and instructs user to close the window.
 *
 * The parent window detects popup close and refetches integration data.
 * Also notifies parent to open the project selector.
 */
export default function VercelConnectedPage() {
	useEffect(() => {
		// Notify parent window to open the project selector
		const opener = window.opener as Window | null;
		if (opener) {
			try {
				// Post message to parent window to trigger project selector
				opener.postMessage({ type: "vercel_connected" }, "*");
			} catch {
				// Ignore cross-origin errors
			}
		}

		// Auto-close after 2 seconds
		const timer = setTimeout(() => {
			window.close();
		}, 2000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="text-center space-y-6 p-8">
				{/* Success Icon */}
				<div className="flex justify-center">
					<div className="rounded-full bg-green-500/10 p-4">
						<CheckCircle2 className="h-16 w-16 text-green-500" />
					</div>
				</div>

				{/* Success Message */}
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold text-foreground">
						Vercel Connected!
					</h1>
					<p className="text-muted-foreground">
						Your Vercel account has been successfully connected.
					</p>
				</div>

				{/* Close Instructions */}
				<div className="space-y-2">
					<p className="text-sm text-muted-foreground">
						This window will close automatically...
					</p>
					<button
						onClick={() => window.close()}
						className="text-sm text-primary hover:underline"
					>
						Or click here to close now
					</button>
				</div>
			</div>
		</div>
	);
}
