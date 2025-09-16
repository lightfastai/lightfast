"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useRouter, usePathname } from "next/navigation";

type BackDestination = "home" | "plans" | "new" | "upgrade" | "back";

interface LayoutBackButtonProps {
	className?: string;
	destination?: BackDestination;
}

export function LayoutBackButton({
	className,
	destination,
}: LayoutBackButtonProps) {
	const router = useRouter();
	const pathname = usePathname();

	// Auto-determine destination if not provided
	const getDestination = (): BackDestination => {
		if (destination) return destination;
		
		if (pathname.includes("/billing/upgrade")) {
			return "new";
		}
		if (pathname.includes("/billing/checkout")) {
			return "upgrade";
		}
		return "back";
	};

	const finalDestination = getDestination();

	const handleBack = () => {
		switch (finalDestination) {
			case "home":
				router.push("/");
				break;
			case "plans":
				router.push("/billing/upgrade");
				break;
			case "new":
				router.push("/new");
				break;
			case "upgrade":
				router.push("/billing/upgrade");
				break;
			case "back":
			default:
				router.back();
				break;
		}
	};

	const getButtonText = () => {
		switch (finalDestination) {
			case "home":
				return "Back to Home";
			case "plans":
				return "Back to Plans";
			case "new":
				return "Back to Chat";
			case "upgrade":
				return "Back to Plans";
			case "back":
			default:
				return null; // No text for default back behavior
		}
	};

	const buttonText = getButtonText();
	const isIconOnly = !buttonText;

	return (
		<Button
			variant="ghost"
			size={isIconOnly ? "icon" : "default"}
			onClick={handleBack}
			className={`${isIconOnly ? "" : "gap-2"} ${className ?? ""}`}
		>
			<ArrowLeft className="h-5 w-5" />
			{buttonText && <span>{buttonText}</span>}
		</Button>
	);
}

