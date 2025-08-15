"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Settings } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { GeneralTab } from "./tabs/general-tab";
import { AccountTab } from "./tabs/account-tab";

export type SettingsTab = "general" | "account";

interface SettingsDialogProps {
	children?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: controlledOpen, onOpenChange }: SettingsDialogProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<SettingsTab>("general");

	// Use controlled state if provided, otherwise use internal state
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;

	const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
		{
			id: "general",
			label: "General",
			icon: <Settings className="h-4 w-4" />,
		},
		{
			id: "account",
			label: "Account",
			icon: (
				<svg
					className="h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
			),
		},
	];

	return (
		<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
					<div className="flex h-[500px]">
						{/* Sidebar */}
						<div className="w-48 border-r border-border bg-muted/30 p-4">
							<DialogHeader className="mb-6">
							</DialogHeader>

							<nav className="space-y-1">
								{tabs.map((tab) => (
									<button
										key={tab.id}
										onClick={() => setActiveTab(tab.id)}
										className={cn(
											"w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
											activeTab === tab.id
												? "bg-background text-foreground"
												: "text-muted-foreground hover:bg-background/50 hover:text-foreground"
										)}
									>
										{tab.icon}
										{tab.label}
									</button>
								))}
							</nav>
						</div>

						{/* Content */}
						<div className="flex-1 p-6">
							<DialogHeader className="mb-6">
								<DialogTitle>
									{tabs.find((t) => t.id === activeTab)?.label}
								</DialogTitle>
								<DialogDescription>
									{activeTab === "general" &&
										"Customize your app experience and preferences"}
									{activeTab === "account" &&
										"Manage your account information and settings"}
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-6">
								{activeTab === "general" && <GeneralTab />}
								{activeTab === "account" && <AccountTab />}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
	);
}