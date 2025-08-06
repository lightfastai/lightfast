import React from "react";
import Link from "next/link";
import { ZapIcon } from "lucide-react";

import { siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";

export default function HomePage() {
	return (
		<LightfastCustomGridBackground.Root
			marginVertical={`15vh`}
			marginHorizontal={`20vw`}
			marginVerticalMobile={`20vh`}
			marginHorizontalMobile={`20vw`}
		>
			<LightfastCustomGridBackground.Container className="p-4 sm:p-8">
				<div className="relative h-full w-full">
					<div className="absolute top-0 right-0 left-0">
						<p className="text-foreground max-w-2xl text-2xl font-bold sm:text-3xl lg:text-4xl">
							Crafting tomorrow's AI backbone with open-source infrastructure.
						</p>
					</div>

					<div className="absolute bottom-0 left-0">
						<Icons.logoShort className="text-primary w-10 h-6" />
					</div>

					<div className="absolute right-0 bottom-0">
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
			</LightfastCustomGridBackground.Container>
		</LightfastCustomGridBackground.Root>
	);
}
