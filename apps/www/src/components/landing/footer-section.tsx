import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { getAppUrl } from "@repo/url-utils";

export function FooterSection() {
	const cloudUrl = getAppUrl("cloud");
	const chatUrl = getAppUrl("chat");

	return (
		<footer className="bg-background">
			<div className="mx-auto max-w-6xl px-4 py-20">
				<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
					{/* Logo and Copyright */}
					<div className="col-span-1 md:col-span-1">
						<Link href="/" className="flex items-center">
							<Icons.logoShort className="h-6 w-6" />
						</Link>
					</div>

					{/* Product Links */}
					<div>
						<h3 className="mb-4 text-sm font-semibold">Product</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href={cloudUrl}
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Cloud
								</Link>
							</li>
							<li>
								<Link
									href={chatUrl}
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Chat
								</Link>
							</li>
						</ul>
					</div>

					{/* Legal Links */}
					<div>
						<h3 className="mb-4 text-sm font-semibold">Legal</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/privacy"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Privacy Policy
								</Link>
							</li>
							<li>
								<Link
									href="/terms"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Terms of Service
								</Link>
							</li>
						</ul>
					</div>

					{/* Empty column for spacing on larger screens */}
					<div className="hidden md:block"></div>
				</div>
			</div>
		</footer>
	);
}
