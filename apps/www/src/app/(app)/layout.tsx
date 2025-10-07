import { EnhancedHeader } from "~/components/enhanced-header";
import { FooterSection } from "~/components/landing/footer-section";

interface MarketingLayoutProps {
	children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
	return (
		<div className="framework relative flex min-h-screen flex-col">
			<div className="bg-background">
				<EnhancedHeader />
			</div>
			<div className="relative flex-1">
				<main className="h-full">{children}</main>
			</div>
			<FooterSection />
		</div>
	);
}
