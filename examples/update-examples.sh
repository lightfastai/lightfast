#!/bin/bash

# Update agent-workflow-starter
cat > agent-workflow-starter/package.json << 'EOF'
{
  "name": "agent-workflow-starter",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "devDependencies": {
    "@types/minimatch": "^6.0.0",
    "@types/node": "22.13.2",
    "@types/react": "18.3.19",
    "@types/react-dom": "18.3.6",
    "autoprefixer": "10.4.20",
    "postcss": "8.5.3",
    "tailwindcss": "3.4.17",
    "typescript": "5.9.2"
  },
  "dependencies": {
    "next": "14.2.21",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
EOF

cat > agent-workflow-starter/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Workflow Starter",
  description: "State-machine orchestration for complex agent workflows with Lightfast",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
EOF

cat > agent-workflow-starter/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Agent Workflow Starter</h1>
        <p className="text-lg text-gray-600 mb-8">
          State-machine orchestration with resource scheduling and error handling
        </p>
        <div className="bg-gray-100 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-2">Workflow dashboard coming soon...</p>
          <div className="bg-white rounded p-4 shadow-sm">
            <p>Welcome! This is a placeholder for the agent workflow interface.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
EOF

# Update human-in-the-loop-dashboard
cat > human-in-the-loop-dashboard/package.json << 'EOF'
{
  "name": "human-in-the-loop-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "devDependencies": {
    "@types/minimatch": "^6.0.0",
    "@types/node": "22.13.2",
    "@types/react": "18.3.19",
    "@types/react-dom": "18.3.6",
    "autoprefixer": "10.4.20",
    "postcss": "8.5.3",
    "tailwindcss": "3.4.17",
    "typescript": "5.9.2"
  },
  "dependencies": {
    "next": "14.2.21",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
EOF

cat > human-in-the-loop-dashboard/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human-in-the-Loop Dashboard",
  description: "Interactive dashboard for human review workflows with Lightfast",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
EOF

cat > human-in-the-loop-dashboard/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Human-in-the-Loop Dashboard</h1>
        <p className="text-lg text-gray-600 mb-8">
          Interactive dashboard for human review and approval workflows
        </p>
        <div className="bg-gray-100 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-2">Review dashboard coming soon...</p>
          <div className="bg-white rounded p-4 shadow-sm">
            <p>Welcome! This is a placeholder for the human-in-the-loop interface.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
EOF

# Update multi-agent-system
cat > multi-agent-system/package.json << 'EOF'
{
  "name": "multi-agent-system",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "devDependencies": {
    "@types/minimatch": "^6.0.0",
    "@types/node": "22.13.2",
    "@types/react": "18.3.19",
    "@types/react-dom": "18.3.6",
    "autoprefixer": "10.4.20",
    "postcss": "8.5.3",
    "tailwindcss": "3.4.17",
    "typescript": "5.9.2"
  },
  "dependencies": {
    "next": "14.2.21",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
EOF

cat > multi-agent-system/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-Agent System",
  description: "Coordinate multiple AI agents with shared memory using Lightfast",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
EOF

cat > multi-agent-system/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Multi-Agent System</h1>
        <p className="text-lg text-gray-600 mb-8">
          Coordinate multiple AI agents with shared memory and task delegation
        </p>
        <div className="bg-gray-100 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-2">Agent system coming soon...</p>
          <div className="bg-white rounded p-4 shadow-sm">
            <p>Welcome! This is a placeholder for the multi-agent system interface.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
EOF

# Update browser-automation-agent
cat > browser-automation-agent/package.json << 'EOF'
{
  "name": "browser-automation-agent",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "devDependencies": {
    "@types/minimatch": "^6.0.0",
    "@types/node": "22.13.2",
    "@types/react": "18.3.19",
    "@types/react-dom": "18.3.6",
    "autoprefixer": "10.4.20",
    "postcss": "8.5.3",
    "tailwindcss": "3.4.17",
    "typescript": "5.9.2"
  },
  "dependencies": {
    "next": "14.2.21",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
EOF

cat > browser-automation-agent/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Browser Automation Agent",
  description: "Web scraping and automation with Browserbase and Lightfast",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
EOF

cat > browser-automation-agent/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Browser Automation Agent</h1>
        <p className="text-lg text-gray-600 mb-8">
          Web scraping and automation with Browserbase integration
        </p>
        <div className="bg-gray-100 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-2">Automation interface coming soon...</p>
          <div className="bg-white rounded p-4 shadow-sm">
            <p>Welcome! This is a placeholder for the browser automation interface.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
EOF

echo "All examples updated!"