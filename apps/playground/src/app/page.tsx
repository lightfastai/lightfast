"use client";

import Link from "next/link";
import { appUrl } from "~/lib/related-projects";

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="mb-4">
        <Link 
          href={appUrl} 
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to App
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-4">Lightfast Playground</h1>
      <p className="text-gray-600">Minimal playground setup</p>
    </div>
  );
}