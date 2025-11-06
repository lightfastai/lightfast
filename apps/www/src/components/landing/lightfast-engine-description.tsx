/**
 * Lightfast Engine Description Component
 *
 * Showcases Lightfast's three technical pillars:
 * 1. Console Sync Engine - Deep reasoning and complex orchestration
 * 2. Deep Context Graph - Unified understanding across tools
 * 3. Security by Design - Sandboxed execution and runtime validation
 */

export function LightfastEngineDescription() {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10">
      {/* Pillar 1: Console Sync Engine */}
      <h3 className="text-md font-semibold text-foreground">
        Console Sync Engine
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        Built for deep reasoning and complex orchestration. Maintains context
        across multi-step workflows and coordinates your entire stack.
      </p>

      {/* Pillar 2: Deep Context Graph */}
      <h3 className="text-md font-semibold text-foreground">
        Deep Context Graph
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        Unified understanding across your codebase, business content, and tools.
        Correlates GitHub commits, Linear issues, PostHog analytics, and Sentry
        errors as one knowledge graph.
      </p>

      {/* Pillar 3: Security by Design */}
      <h3 className="text-md font-semibold text-foreground">
        Security by Design
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        Sandboxed execution for every workflow. Scoped credentials, runtime
        validation, and human-in-the-loop for critical actions.
      </p>
    </div>
  );
}
