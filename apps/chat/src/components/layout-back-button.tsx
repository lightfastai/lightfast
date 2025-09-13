"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useRouter } from "next/navigation";

interface LayoutBackButtonProps {
	className?: string;
}

export function LayoutBackButton({ className }: LayoutBackButtonProps) {
	const router = useRouter();

	const handleBack = () => {
		router.back();
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={handleBack}
			aria-label="Go back"
			className={className}
		>
			<ArrowLeft className="h-5 w-5" />
		</Button>
	);
}