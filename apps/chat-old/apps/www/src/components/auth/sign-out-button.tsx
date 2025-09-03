"use client";

import { useAuthActions } from "@/hooks/use-auth";
import { Button } from "@lightfast/ui/components/ui/button";
import { useConvexAuth } from "convex/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface SignOutButtonProps {
	className?: string;
	size?: "default" | "sm" | "lg" | "icon";
	variant?:
		| "default"
		| "destructive"
		| "outline"
		| "secondary"
		| "ghost"
		| "link";
	children?: React.ReactNode;
	redirectTo?: string;
	showOnlyWhenAuthenticated?: boolean;
	onSignOutStart?: () => void;
	onSignOutComplete?: () => void;
}

export function SignOutButton({
	className,
	size = "default",
	variant = "outline",
	children,
	redirectTo = "/sign-in",
	showOnlyWhenAuthenticated = true,
	onSignOutStart,
	onSignOutComplete,
}: SignOutButtonProps) {
	const { isAuthenticated } = useConvexAuth();
	const { signOut } = useAuthActions();
	const router = useRouter();

	const handleSignOut = async () => {
		try {
			onSignOutStart?.();
			await signOut();
			if (redirectTo) {
				router.push(redirectTo);
			}
			onSignOutComplete?.();
		} catch (error) {
			console.error("Error signing out:", error);
		}
	};

	// Don't render if user is not authenticated and showOnlyWhenAuthenticated is true
	if (showOnlyWhenAuthenticated && !isAuthenticated) {
		return null;
	}

	return (
		<Button
			onClick={handleSignOut}
			className={className}
			size={size}
			variant={variant}
		>
			{children || (
				<>
					<LogOut className="w-4 h-4 mr-2" />
					Sign out
				</>
			)}
		</Button>
	);
}
