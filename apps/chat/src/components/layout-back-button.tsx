"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useRouter } from "next/navigation";

type BackDestination = "home" | "plans" | "back";

interface LayoutBackButtonProps {
	className?: string;
	destination?: BackDestination;
}

export function LayoutBackButton({
	className,
	destination = "back",
}: LayoutBackButtonProps) {
	const router = useRouter();

	const handleBack = () => {
		switch (destination) {
			case "home":
				router.push("/");
				break;
			case "plans":
				router.push("/upgrade");
				break;
			case "back":
			default:
				router.back();
				break;
		}
	};

	const getButtonText = () => {
		switch (destination) {
			case "home":
				return "Back to Home";
			case "plans":
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

