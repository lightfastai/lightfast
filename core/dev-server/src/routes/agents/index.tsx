import { createFileRoute, Link } from "@tanstack/react-router";
import type { LightfastMetadata, LightfastDevConfig } from "lightfast/client";
import type { Agent } from "lightfast/agent";

// Infer the serialized Agent type from what JSON.stringify would produce
type SerializedAgent = Pick<Agent, 'vercelConfig' | 'lightfastConfig'>;

// Type for the API response data structure  
interface APIResponseData {
	agents: Record<string, SerializedAgent>;
	metadata?: LightfastMetadata;
	dev?: LightfastDevConfig;
}

export const Route = createFileRoute("/agents/")({
	component: AgentsPage,
	loader: async () => {
		// Fetch from the API endpoint instead of directly importing server modules
		const response = await fetch('/api/agents');
		
		if (!response.ok) {
			return {
				success: false,
				error: 'Failed to fetch agents',
				message: `API request failed: ${response.statusText}`,
			};
		}

		const result = await response.json();
		
		if (!result.success) {
			return result;
		}

		// The API now returns the full agents record directly
		return {
			success: true,
			data: {
				agents: result.data.agents,
				metadata: result.data.metadata,
				dev: result.data.dev,
			},
		};
	},
});

function AgentsPage() {
	const loaderData = Route.useLoaderData();

	// Handle error state
	if (!loaderData.success) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center text-destructive">
					<p className="text-lg font-semibold">Error loading agents</p>
					<p className="text-sm mt-2">{loaderData.message || loaderData.error}</p>
				</div>
			</div>
		);
	}

	const lightfastData = loaderData.data;

	// Handle no agents case
	if (!lightfastData || !lightfastData.agents || Object.keys(lightfastData.agents).length === 0) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<p className="text-lg font-semibold">No agents configured</p>
					<p className="text-sm text-muted-foreground mt-2">
						Configure agents in your lightfast.config.ts file
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 max-w-7xl">
			{/* Agents Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Object.entries(lightfastData.agents).map(([agentKey, agent]) => (
					<AgentCard
						key={agentKey}
						agentKey={agentKey}
						agent={agent}
					/>
				))}
			</div>
		</div>
	);
}

function AgentCard({ agentKey, agent }: { agentKey: string; agent: SerializedAgent }) {
	// Access the serialized agent data structure with proper types
	const agentName = agent.lightfastConfig.name;
	const modelId = agent.vercelConfig.model.modelId;

	return (
		<Link
			to="/agents/$agentId"
			params={{ agentId: agentKey }}
			className="block bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer"
		>
			{/* Agent Name */}
			<h3 className="text-lg font-semibold mb-2">{agentName}</h3>

			{/* Agent Key */}
			<p className="text-sm text-muted-foreground font-mono mb-4">{agentKey}</p>

			{/* Model Badge */}
			<div className="mb-4">
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border bg-gray-500/10 text-gray-500 border-gray-500/20">
					{modelId}
				</span>
			</div>

			{/* Agent Configuration */}
			<div className="text-sm text-muted-foreground space-y-1">
				<p>Model: {modelId}</p>
			</div>
		</Link>
	);
}

