import React from "react";
import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { siteConfig } from "@repo/lightfast-config";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<LightfastCustomGridBackground.Root 
			marginVertical="15vh" 
			marginHorizontal="15vw"
			marginVerticalMobile="5vh"
			marginHorizontalMobile="5vw"
		>
			<LightfastCustomGridBackground.Container>
				{/* Grid - switches from columns to rows on mobile/tablet */}
				<div className="grid grid-cols-1 lg:grid-cols-12 h-full">
					{/* Top/Left section - content */}
					<div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-border/50">
						<div className="relative h-full p-6 lg:p-8">
							{/* Text at top left */}
							<div className="lg:absolute lg:top-8 lg:left-8 lg:right-8">
								<p className="text-foreground max-w-xl text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold">
									Build the future of AI with Lightfast infrastructure.
								</p>
								<p className="text-muted-foreground text-sm mt-4">
									We are currently in alpha
								</p>
							</div>

							{/* Logo - hidden on mobile, shown at bottom on desktop */}
							<div className="hidden lg:block absolute bottom-8 left-8">
								<Link href={siteConfig.url} target="_blank" rel="noopener noreferrer">
									<Icons.logoShort className="text-primary w-10 h-6 hover:opacity-80 transition-opacity cursor-pointer" />
								</Link>
							</div>
						</div>
					</div>

					{/* Bottom/Right section - auth forms */}
					<div className="lg:col-span-5 flex items-center justify-center p-6 lg:p-8">
						<div className="w-full max-w-sm">
							{children}
						</div>
					</div>
				</div>
			</LightfastCustomGridBackground.Container>
		</LightfastCustomGridBackground.Root>
	);
}