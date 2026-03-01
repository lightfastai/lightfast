"use client";

import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function CLIAuthContent() {
	const { getToken, isSignedIn, isLoaded } = useAuth();
	const searchParams = useSearchParams();
	const port = searchParams.get("port");
	const state = searchParams.get("state");
	const [status, setStatus] = useState<"loading" | "redirecting" | "error">(
		"loading",
	);

	useEffect(() => {
		if (!isLoaded) return;
		if (!isSignedIn) return;
		if (!port || !state) {
			setStatus("error");
			return;
		}

		// Validate port is a number in valid range
		const portNum = Number.parseInt(port, 10);
		if (Number.isNaN(portNum) || portNum < 1024 || portNum > 65535) {
			setStatus("error");
			return;
		}

		void (async () => {
			try {
				const token = await getToken();
				if (!token) {
					setStatus("error");
					return;
				}
				setStatus("redirecting");
				window.location.href = `http://localhost:${portNum}/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
			} catch {
				setStatus("error");
			}
		})();
	}, [isLoaded, isSignedIn, port, state, getToken]);

	if (status === "error") {
		return (
			<div className="flex min-h-full items-center justify-center">
				<div className="text-center">
					<h1 className="text-xl font-semibold">Authentication Failed</h1>
					<p className="mt-2 text-muted-foreground">
						Invalid parameters. Please try again from your terminal.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-full items-center justify-center">
			<div className="text-center">
				<h1 className="text-xl font-semibold">
					{status === "redirecting"
						? "Redirecting to CLI..."
						: "Authenticating..."}
				</h1>
				<p className="mt-2 text-muted-foreground">
					You'll be redirected back to your terminal shortly.
				</p>
			</div>
		</div>
	);
}

export function CLIAuthClient() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-full items-center justify-center">
					<div className="text-center">
						<h1 className="text-xl font-semibold">Authenticating...</h1>
						<p className="mt-2 text-muted-foreground">
							You'll be redirected back to your terminal shortly.
						</p>
					</div>
				</div>
			}
		>
			<CLIAuthContent />
		</Suspense>
	);
}
