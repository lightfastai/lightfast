export default function Home() {
	// This page should not be reached due to middleware redirect
	// But we'll show a message just in case
	return (
		<main className="flex h-screen items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-bold mb-2">HAL9000</h1>
				<p className="text-muted-foreground">Redirecting to chat...</p>
			</div>
		</main>
	);
}
