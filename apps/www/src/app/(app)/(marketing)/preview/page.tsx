import { McpAgentVisual } from "~/components/landing/mcp-agent-visual";
import { NeuralMemoryVisual } from "~/components/landing/neural-memory-visual";

export default function PreviewPage() {
  return (
    <div className="container mx-auto py-16 space-y-24">
      {/* MCP Agent Visual */}
      <section>
        <h2 className="text-xl font-semibold mb-6 text-muted-foreground">
          MCP Agent Visual
        </h2>
        <div className="h-[600px]">
          <McpAgentVisual />
        </div>
      </section>

      {/* Neural Memory Visual */}
      <section>
        <h2 className="text-xl font-semibold mb-6 text-muted-foreground">
          Neural Memory Visual
        </h2>
        <div className="h-[600px]">
          <NeuralMemoryVisual />
        </div>
      </section>
    </div>
  );
}
