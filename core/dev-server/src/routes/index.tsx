import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome to Lightfast</h1>
        <p className="text-muted-foreground">
          Cloud-native agent execution engine for production AI applications
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-2">⚡ Getting Started</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a lightfast.config.ts file in your project root to define your agents.
          </p>
          <Link
            to="/agents"
            className="text-sm text-primary hover:underline"
          >
            View configured agents →
          </Link>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-2">📚 Documentation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Learn how to build, test, and deploy AI agents with Lightfast.
          </p>
          <a
            href="https://lightfast.ai/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Read the docs →
          </a>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-2">🚀 Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CLI Version:</span>
              <span className="font-mono">0.2.1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Runtime:</span>
              <span className="font-mono">Node v20+</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="text-green-500">● Running</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="p-6 rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-3">Configuration Status</h2>
          <p className="text-sm text-muted-foreground">
            This dev server automatically discovers and loads agents from your lightfast.config.ts file.
            Place the configuration file in your project root to see your agents here.
          </p>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-3">Development Tools</h2>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">👁️</span>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Auto Reload
              </h3>
              <span className="text-xs font-medium text-green-500">
                Active
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              The dev server automatically reloads when you make changes to your configuration files.
              Watch your CLI terminal for compilation status.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}