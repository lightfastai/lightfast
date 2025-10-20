import { MarketingHeader } from "~/components/marketing/marketing-header";

export default function SubpagesLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<MarketingHeader />
			{children}
		</>
	);
}
