"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { UserDropdownMenu } from "./user-dropdown-menu";

export function AuthenticatedHeader() {
	return (
		<>
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-4 bg-background border-b border-border/50 z-10">
				{/* Left side - Logo */}
				<div className="flex items-center">
					<Button variant="ghost" size="xs" asChild>
						<Link href="/">
							<Icons.logoShort className="h-4 w-auto text-foreground" />
						</Link>
					</Button>
				</div>

				{/* Right side - User menu */}
				<div className="flex items-center gap-2">
					<UserDropdownMenu />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Left side - Logo only */}
			<div className="hidden lg:flex absolute top-0 left-0 h-14 items-center pl-2 z-10 w-fit">
				<Button variant="ghost" size="lg" asChild>
					<Link href="/">
						<Icons.logo className="size-22 text-foreground" />
					</Link>
				</Button>
			</div>

			{/* Desktop Right side - User menu */}
			<div className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-2 z-10 w-fit">
				<UserDropdownMenu />
			</div>
		</>
	);
}
