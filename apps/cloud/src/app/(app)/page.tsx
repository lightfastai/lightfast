import { WaitlistForm } from "../../components/waitlist-form";

export default function HomePage() {
	return (
		<div className="h-full flex flex-col items-center justify-center px-6 py-12">
			<div className="space-y-16">
				<div className="max-w-md text-center">
					<h1 className="text-4xl font-bold mb-4">Build on Lightfast Cloud</h1>
					<p className="text-muted-foreground text-xs">
						Join the waitlist or sign in with your developer account to build
						with the Lightfast Cloud
					</p>
				</div>

				<div className="flex justify-center">
					<div className="w-full max-w-sm">
						<WaitlistForm />
					</div>
				</div>
			</div>
		</div>
	);
}
