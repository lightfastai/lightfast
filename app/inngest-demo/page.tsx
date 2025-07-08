import { AgentDemo } from '@/components/agent-demo';
import { SandboxDemo } from '@/components/sandbox-demo';

export default function InngestDemoPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          Inngest + Vercel Sandbox + AgentKit Demo
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          This demo showcases how Inngest functions can leverage Vercel Sandbox for secure code
          execution and AgentKit for AI-powered coding assistance. All executed in serverless
          background jobs!
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
        <SandboxDemo />
        <AgentDemo />
      </div>

      <div className="mt-12 rounded-lg bg-muted p-6">
        <h2 className="text-xl font-semibold mb-4">How it works</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">1. Inngest Functions</h3>
            <p className="text-muted-foreground">
              Background jobs are handled by Inngest functions that run reliably and can be
              monitored through the Inngest dashboard. Events trigger functions asynchronously.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. Vercel Sandbox</h3>
            <p className="text-muted-foreground">
              Code is executed in isolated, secure containers. Each execution gets a fresh
              environment preventing any cross-contamination between runs.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. AgentKit Integration</h3>
            <p className="text-muted-foreground">
              The AI agent can write and test code using the sandbox environment, providing
              intelligent coding assistance with real execution capabilities.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">4. Next.js App Router</h3>
            <p className="text-muted-foreground">
              API routes handle incoming requests and trigger Inngest events. The UI is built with
              React Server Components and shadcn/ui for a modern experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
