// Navigation helper page for blocking tests
import Link from "next/link";

export default function BlockingTestNavPage() {
	return (
		<div className="p-8 space-y-4">
			<h1 className="text-2xl font-bold mb-6">Blocking Test Navigation</h1>
			
			<div className="space-y-2">
				<p className="text-sm text-muted-foreground mb-4">
					Test navigation blocking by:
					1. Click a test page
					2. Hard refresh (Cmd+R)
					3. Navigate to another page
					4. Navigate back to the hard-refreshed page
				</p>
				
				<div className="flex flex-col gap-2">
					<Link 
						href="/blocking-test-1" 
						className="p-3 border rounded hover:bg-muted transition-colors"
						prefetch={true}
					>
						→ Test 1: Basic page (no data)
					</Link>
					
					<Link 
						href="/blocking-test-2" 
						className="p-3 border rounded hover:bg-muted transition-colors"
						prefetch={true}
					>
						→ Test 2: Basic page 2 (no data)
					</Link>
					
					<Link 
						href="/blocking-test-3" 
						className="p-3 border rounded hover:bg-muted transition-colors"
						prefetch={true}
					>
						→ Test 3: With prefetch + HydrateClient
					</Link>
					
					<Link 
						href="/blocking-test-4" 
						className="p-3 border rounded hover:bg-muted transition-colors"
						prefetch={true}
					>
						→ Test 4: With useSuspenseQuery
					</Link>
					
					<hr className="my-2" />
					
					<Link 
						href="/new" 
						className="p-3 border rounded hover:bg-muted transition-colors"
						prefetch={true}
					>
						→ Real /new page
					</Link>
					
					<Link 
						href="/blocking-test-nav" 
						className="p-3 border rounded hover:bg-muted transition-colors"
						prefetch={true}
					>
						↻ Refresh Nav Page
					</Link>
				</div>
			</div>
			
			<div className="mt-8 p-4 bg-muted rounded">
				<p className="text-xs">Page rendered at: {new Date().toISOString()}</p>
			</div>
		</div>
	);
}