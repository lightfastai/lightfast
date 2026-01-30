"use client";

import { UnicornScene } from "~/components/unicorn-scene";

export default function UnicornTestPage() {
  return (
    <div className="min-h-screen bg-black p-8">
      <h1 className="text-2xl font-bold text-white mb-4">
        Unicorn Studio Test Page
      </h1>
      <p className="text-gray-400 mb-8">
        Testing Project ID: l4I4U2goI9votcrBdYG1
      </p>

      {/* Full width responsive scene */}
      <div className="w-full border border-white/20 rounded-lg overflow-hidden h-[600px]">
        <UnicornScene
          projectId="l4I4U2goI9votcrBdYG1"
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
