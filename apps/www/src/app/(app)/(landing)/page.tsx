import React from "react";
import Link from "next/link";
import { ZapIcon } from "lucide-react";

import { siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";

export default function HomePage() {
	return (
		<div className="flex items-center justify-center min-h-[calc(100vh-80px)] overflow-hidden">
			<div className="relative w-[90vw] max-w-6xl h-[60vh] border border-border/50 p-12">
				<div className="absolute top-12 left-12 right-12">
					<p className="text-foreground max-w-2xl text-2xl font-bold sm:text-3xl lg:text-4xl">
						Crafting tomorrow's AI backbone with open-source infrastructure.
					</p>
				</div>

				<div className="absolute bottom-12 left-12">
					<Icons.logoShort className="text-primary w-10 h-6" />
				</div>

				<div className="absolute right-12 bottom-12">
					<Button asChild variant="outline">
						<Link
							className="text-foreground flex items-center"
							href={siteConfig.links.chat.href}
						>
							<ZapIcon className="mr-1 h-4 w-4" />
							Get Started
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
