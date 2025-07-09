import { InvestigationChat } from '@/components/investigation-chat';

export default function InvestigationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">Code Investigation Agent Network</h1>
        <p className="text-center text-muted-foreground mb-12">
          Investigate any GitHub repository using AI-powered agents that generate and execute bash
          scripts in isolated Vercel Sandboxes to analyze code structure, dependencies, and
          patterns.
        </p>

        <InvestigationChat />

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This demo uses Inngest for orchestration, OpenAI for script generation, and Vercel
            Sandbox for secure code execution.
          </p>
        </div>
      </div>
    </main>
  );
}
