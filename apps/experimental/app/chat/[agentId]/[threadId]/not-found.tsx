import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<h2 className="text-2xl font-semibold mb-2">Agent Not Found</h2>
			<p className="text-muted-foreground mb-4">The requested agent does not exist.</p>
			<Link href="/" className="text-primary hover:text-primary/80">
				Return Home
			</Link>
		</div>
	);
}
