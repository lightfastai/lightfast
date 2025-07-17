import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24">
			<h1 className="text-4xl font-bold">HAL9000 - Mastra AI Assistant</h1>
			<p className="mt-4 text-lg text-center">Welcome to the Next.js version of HAL9001</p>
			<div className="mt-8 flex gap-4">
				<Button>Get Started</Button>
				<Button variant="outline">Learn More</Button>
				<Button variant="secondary">Documentation</Button>
			</div>
		</main>
	);
}

