import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";

export default function NotFound() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="border border-dashed border-border p-32 flex flex-col items-center">
				{/* Lightfast logo */}
				<div className="mb-8">
					<Icons.logoShort className="w-10 h-8 text-white" />
				</div>

				{/* Large 404 heading */}
				<h1 className="text-8xl font-bold tracking-tighter mb-4">404</h1>

				{/* Error message */}
				<p className="text-muted-foreground text-lg mb-8">Sorry, we couldn't find the page you're looking for.</p>

				{/* Call to action button */}
				<Button asChild>
					<Link href="/">Return Home</Link>
				</Button>
			</div>
		</div>
	);
}
