export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-8">
            Welcome to Your Chat App
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
            Built with Next.js, Convex, and Biome
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Next.js
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Modern React framework with server-side rendering and routing
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Convex
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Real-time backend with database, auth, and functions
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Biome
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Fast formatter and linter for modern web projects
              </p>
            </div>
          </div>

          <div className="mt-12">
            <button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
