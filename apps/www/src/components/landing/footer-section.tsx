import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { emailConfig, siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";
import { getAppUrl } from "@repo/url-utils";

export function SiteFooter() {
	const chatUrl = getAppUrl("chat");
	const cloudUrl = getAppUrl("cloud");

	return (
		<footer className="bg-background relative w-full text-white py-12 sm:py-16 lg:py-24">
			{/* Section 1 - Logo and Products/Links */}
			<section className="pb-8 sm:pb-10 lg:pb-12 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					{/* Mobile/Tablet: Stack vertically, Desktop: Side by side with proper alignment */}
					<div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-12">
						{/* Logo - Fixed width on desktop for alignment */}
						<div className="flex-shrink-0 lg:w-1/2">
							<Icons.logo className="text-foreground w-24 sm:w-28 lg:w-32" />
						</div>

						{/* Products and Links - Right aligned section */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-8 lg:gap-16 xl:gap-24 lg:w-1/2">
							{/* Products Column */}
							<div className="flex flex-col">
								<h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-xl font-semibold">
									Products
								</h3>
								<nav className="flex flex-col gap-2 sm:gap-3">
									<Link
										href={chatUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-foreground hover:text-muted-foreground text-lg sm:text-xl lg:text-2xl font-bold transition-colors duration-200"
									>
										Chat
									</Link>
									<Link
										href={cloudUrl}
										className="text-foreground hover:text-muted-foreground text-lg sm:text-xl lg:text-2xl font-bold transition-colors duration-200"
									>
										Cloud
									</Link>
									<Link
										href="/docs/sdk"
										className="text-foreground hover:text-muted-foreground text-lg sm:text-xl lg:text-2xl font-bold transition-colors duration-200"
									>
										SDK
									</Link>
								</nav>
							</div>

							{/* Links Column */}
							<div className="flex flex-col">
								<h3 className="text-muted-foreground mb-3 text-base sm:text-lg lg:text-xl font-semibold">
									Links
								</h3>
								<nav className="flex flex-col gap-2 sm:gap-3">
									<Link
										href="/legal/terms"
										className="text-foreground hover:text-muted-foreground text-lg sm:text-xl lg:text-2xl font-bold transition-colors duration-200"
									>
										<span className="block sm:hidden">Terms</span>
										<span className="hidden sm:block">
											Terms & Conditions
										</span>
									</Link>
									<Link
										href="/legal/privacy"
										className="text-foreground hover:text-muted-foreground text-lg sm:text-xl lg:text-2xl font-bold transition-colors duration-200"
									>
										<span className="block sm:hidden">Privacy</span>
										<span className="hidden sm:block">Privacy Policy</span>
									</Link>
								</nav>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Section 2 - Contact and Early Access */}
			<section className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					{/* Stack on mobile/tablet, side by side on desktop with proper alignment */}
					<div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-12">
						{/* Contact - Fixed width on desktop */}
						<div className="flex flex-col lg:w-1/2">
							<h3 className="text-foreground mb-2 text-base sm:text-lg font-semibold">
								Have questions or want to chat?
							</h3>
							<div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
								<span className="text-foreground text-sm sm:text-base lg:text-lg font-medium">
									Drop us a line at →
								</span>
								<Link
									href={`mailto:${emailConfig.hello}`}
									className="text-primary hover:text-primary/80 text-sm sm:text-base lg:text-lg font-medium transition-colors duration-200 hover:underline break-all"
								>
									{emailConfig.hello}
								</Link>
							</div>
						</div>

						{/* Newsletter Signup - Right aligned */}
						<div className="lg:w-1/2">
							<div className="flex flex-col lg:max-w-xs">
								<h3 className="text-foreground text-sm sm:text-base mb-3 sm:mb-4 font-semibold">
									Stay in the loop and be the first to know what's coming next
									for Lightfast, get industry expert analysis, and much more.
								</h3>
								<div className="flex flex-col gap-2">
									<Link
										href="#"
										className="text-primary hover:text-primary/80 inline-flex w-fit items-center gap-2 text-sm font-medium transition-colors duration-200 hover:underline"
									>
										Subscribe to Lightfast
										<ArrowRight className="size-4" />
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Section 3 - Copyright and Social */}
			<section className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 border-t border-border/10">
				<div className="mx-auto w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					{/* Stack on mobile/tablet, side by side on desktop with proper alignment */}
					<div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-12">
						{/* Social Links - Fixed width on desktop to match other sections */}
						<div className="flex items-center gap-4 sm:gap-6 lg:w-1/2">
							<Link
								target="_blank"
								href={siteConfig.links.github.href}
								aria-label="GitHub"
								className="group transition-all duration-300 hover:scale-110"
							>
								<Icons.gitHub className="text-muted-foreground group-hover:text-foreground size-4 transition-colors duration-300" />
							</Link>
							<Link
								target="_blank"
								href={siteConfig.links.discord.href}
								aria-label="Discord"
								className="group transition-all duration-300 hover:scale-110"
							>
								<Icons.discord className="text-muted-foreground group-hover:text-foreground size-4 transition-colors duration-300" />
							</Link>
							<Link
								target="_blank"
								href={siteConfig.links.twitter.href}
								aria-label="Twitter"
								className="group transition-all duration-300 hover:scale-110"
							>
								<Icons.twitter className="text-muted-foreground group-hover:text-foreground size-3 transition-colors duration-300" />
							</Link>
						</div>

						{/* Copyright and Additional Info - Right aligned */}
						<div className="lg:w-1/2">
							<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 lg:gap-8">
								{/* Copyright */}
								<div className="flex items-center">
									<span className="group text-muted-foreground relative cursor-default text-xs sm:text-sm">
										<span className="group-hover:text-foreground relative inline-block transition-all duration-300 group-hover:-translate-y-1">
											{siteConfig.name}
										</span>
										<span className="group-hover:text-muted-foreground/60 relative mx-1 inline-block transition-all duration-300">
											Inc.
										</span>
										<span className="group-hover:text-muted-foreground/60 relative inline-block transition-all duration-300">
											©
										</span>
										<span className="group-hover:text-foreground relative ml-1 inline-block transition-all duration-300 group-hover:-translate-y-1">
											{new Date().getFullYear()}
										</span>
										<span className="from-primary/40 via-primary to-primary/40 absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r transition-all duration-500 group-hover:w-full" />
									</span>
								</div>

								{/* Additional Info */}
								<div className="hidden sm:block">
									<p className="text-muted-foreground text-xs">
										All rights reserved
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</footer>
	);
}

// Keep the old FooterSection as a fallback export
export function FooterSection() {
	return <SiteFooter />;
}

