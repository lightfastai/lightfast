import { SecurityDashboard } from '@/components/security-dashboard';

export default function SecurityPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔒 Code Security Analysis</h1>
        <p className="text-muted-foreground mb-8">
          Analyze your TypeScript code for security vulnerabilities and best practices.
          Our AI-powered agent focuses on TypeScript-specific security patterns.
        </p>
        <SecurityDashboard />
      </div>
    </main>
  );
}