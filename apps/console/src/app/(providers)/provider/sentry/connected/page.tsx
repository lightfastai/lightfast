"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Sentry OAuth Success Page
 *
 * Displayed in popup window after successful Sentry OAuth authorization.
 * Shows confirmation message and instructs user to close the window.
 *
 * The parent window detects popup close and refetches integration data.
 */
export default function SentryConnectedPage() {
	useEffect(() => {
		// Notify parent via BroadcastChannel (works regardless of window.opener / COOP)
		const channel = new BroadcastChannel("oauth-connections");
		channel.postMessage({ type: "sentry_connected" });
		channel.close();

		// Also try postMessage (works when opener is available)
		const opener = window.opener as Window | null;
		if (opener) {
			try {
				opener.postMessage({ type: "sentry_connected" }, window.location.origin);
			} catch {
				// Guard against SecurityError under strict COOP/COEP
			}
		}

		const timer = setTimeout(() => {
			window.close();
		}, 2000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="text-center space-y-6 p-8">
				<div className="flex justify-center">
					<div className="rounded-full bg-green-500/10 p-4">
						<CheckCircle2 className="h-16 w-16 text-green-500" />
					</div>
				</div>
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold text-foreground">
						Sentry Connected!
					</h1>
					<p className="text-muted-foreground">
						Your Sentry account has been successfully connected.
					</p>
				</div>
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
