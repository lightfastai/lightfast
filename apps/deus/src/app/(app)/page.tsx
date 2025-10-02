export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-4xl text-center space-y-6">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Deus
        </h1>
        <p className="text-2xl text-muted-foreground">
          AI Workflow Orchestration Platform
        </p>
        <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
          Build powerful AI workflow orchestration with natural language. Connect AI to any tool via MCP and automate complex workflows without code.
        </p>
        <div className="pt-8">
          <div className="inline-block px-6 py-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-primary font-medium">
              Coming Soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
