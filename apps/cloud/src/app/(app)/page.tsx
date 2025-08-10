import { WaitlistForm } from "../../components/waitlist-form";

export default function HomePage() {
	return (
		<div className="h-full flex flex-col items-center justify-center p-8 text-center">
			<div className="max-w-md space-y-16">
				<div>
					<h1 className="text-4xl font-bold mb-4">Build on Lightfast Cloud</h1>
					<p className="text-muted-foreground text-xs">
						Join the waitlist or sign in with your developer account to build
						with the Lightfast Cloud
					</p>
				</div>

				<WaitlistForm />
			</div>
		</div>
	);
}
