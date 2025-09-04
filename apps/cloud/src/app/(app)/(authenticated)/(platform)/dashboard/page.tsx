import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Welcome to Lightfast Cloud
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Your cloud-native agent execution engine dashboard. From here you can manage your API keys, 
          monitor your agents, and configure your deployment settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Active Agents
          </h3>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            0
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No agents currently running
          </p>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            API Requests (24h)
          </h3>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            0
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No requests in the last 24 hours
          </p>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Usage Credits
          </h3>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            $0.00
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Current usage this month
          </p>
        </div>
      </div>
    </div>
  );
}