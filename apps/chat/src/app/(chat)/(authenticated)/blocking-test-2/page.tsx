// Minimal test page to isolate blocking navigation issue
// This mimics the new page structure without any data fetching

export default function BlockingTest2Page() {
	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold mb-4">Blocking Test 2</h1>
			<p>This page mimics /new - no data fetching</p>
			<p>Time: {new Date().toISOString()}</p>
		</div>
	);
}