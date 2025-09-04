import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";

export default async function ApiKeysPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            API Keys
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Manage your API keys for accessing Lightfast Cloud services.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center py-8">
          <div className="mx-auto h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Plus className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            No API keys yet
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Create your first API key to start using Lightfast Cloud services.
          </p>
          <div className="mt-4">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create your first API key
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}