import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-8">
            Welcome to Your Chat App
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
            Built with Next.js, Convex, Tailwind CSS v4, Geist fonts, and
            shadcn/ui
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <Card>
              <CardHeader>
                <CardTitle>Next.js</CardTitle>
                <CardDescription>
                  Modern React framework with server-side rendering and routing
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Convex</CardTitle>
                <CardDescription>
                  Real-time backend with database, auth, and functions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>shadcn/ui</CardTitle>
                <CardDescription>
                  Beautiful and accessible components built with Radix UI and
                  Tailwind CSS
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="mt-12 space-x-4">
            <Button size="lg">Get Started</Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>

          <div className="mt-16 p-6 bg-white/80 dark:bg-gray-800/80 rounded-lg backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-4">Typography Showcase</h2>
            <div className="space-y-4 text-left">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Geist Sans (Default)
                </h3>
                <p className="font-sans">
                  This is using Geist Sans, the default sans-serif font. It's
                  clean, modern, and highly readable.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Geist Mono</h3>
                <code className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                  console.log("This is using Geist Mono for code")
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
