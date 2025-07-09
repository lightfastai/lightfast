import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to Next.js 15
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Built with TypeScript, App Router, Tailwind CSS v4, and shadcn/ui
          </p>

          <div className="mb-8 flex gap-4 flex-wrap">
            <Link href="/demo">
              <Button size="lg">View shadcn/ui Demo</Button>
            </Link>
            <Link href="/inngest-demo">
              <Button size="lg" variant="outline">
                View Inngest Integration
              </Button>
            </Link>
            <Link href="/investigation">
              <Button size="lg" variant="outline">
                Code Investigation Agent
              </Button>
            </Link>
            <Link href="/security">
              <Button size="lg" variant="destructive">
                🔒 Security Analysis
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card>
              <CardHeader>
                <CardTitle>TypeScript</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Type-safe development with full IDE support</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>App Router</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Next.js 15's powerful routing and layouts</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tailwind CSS v4</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Modern styling with shadcn/ui components</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
