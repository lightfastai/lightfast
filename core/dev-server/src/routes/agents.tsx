import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { LightfastMetadata, LightfastDevConfig, Agent } from 'lightfast/client';

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

// Type for the API response
interface APIResponse {
  agents: ({ key: string } & Agent)[]; // Agent with key added
  metadata?: LightfastMetadata;
  dev?: LightfastDevConfig;
}

function AgentsPage() {
  const [lightfastData, setLightfastData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch agents from the API
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.statusText}`);
        }
        
        const result = await response.json() as { success: boolean; data?: APIResponse; message?: string };
        
        if (result.success && result.data) {
          setLightfastData(result.data);
        } else {
          throw new Error(result.message ?? 'Failed to load agents');
        }
      } catch (err) {
        console.error('Error fetching agents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    void fetchAgents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-2">⚡</div>
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="text-2xl mb-2">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Error Loading Agents</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!lightfastData || lightfastData.agents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Agents Configured</h2>
          <p className="text-muted-foreground">
            Configure agents using the Lightfast client API
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with metadata */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          ⚡ Lightfast Agents
        </h1>
        {lightfastData.metadata && (
          <div className="text-muted-foreground">
            {lightfastData.metadata.name && (
              <p className="text-lg">{lightfastData.metadata.name}</p>
            )}
            {lightfastData.metadata.description && (
              <p className="text-sm mt-1">{lightfastData.metadata.description}</p>
            )}
            {lightfastData.metadata.version && (
              <p className="text-sm mt-1">Version: {lightfastData.metadata.version}</p>
            )}
          </div>
        )}
      </div>

      {/* Agent count */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {lightfastData.agents.length} agent{lightfastData.agents.length !== 1 ? 's' : ''} configured
        </p>
      </div>

      {/* Agents Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lightfastData.agents.map((agent) => (
          <AgentCard key={agent.key} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: { key: string } & Agent }) {
  const getModelBadgeColor = (agent: Agent) => {
    const model = agent.config.model || '';
    if (typeof model === 'string') {
      if (model.includes("claude")) return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      if (model.includes("gpt")) return "bg-green-500/10 text-green-500 border-green-500/20";
    }
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  };

  const getModelDisplayName = (agent: Agent) => {
    const model = agent.config.model || 'unknown';
    if (typeof model === 'string') {
      if (model.includes("claude-3-5-sonnet")) return "Claude 3.5 Sonnet";
      if (model.includes("gpt-4-turbo")) return "GPT-4 Turbo";
      if (model.includes("gpt-4")) return "GPT-4";
      return model;
    }
    return 'Custom Model';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
      {/* Agent Name */}
      <h3 className="text-lg font-semibold mb-2">{agent.name}</h3>
      
      {/* Agent Key */}
      <p className="text-sm text-muted-foreground font-mono mb-4">{agent.key}</p>

      {/* Model Badge */}
      <div className="mb-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getModelBadgeColor(agent)}`}>
          {getModelDisplayName(agent)}
        </span>
      </div>

      {/* Agent Configuration */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p>Model: {typeof agent.config.model === 'object' ? 'Custom Model' : (agent.config.model || 'Default')}</p>
        {(agent.config as { temperature?: number }).temperature !== undefined && (
          <p>Temperature: {(agent.config as { temperature?: number }).temperature}</p>
        )}
      </div>

      {/* Action Button (for future functionality) */}
      <button className="mt-4 w-full px-3 py-2 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors">
        View Details →
      </button>
    </div>
  );
}