# Next.js 15 + Inngest + Vercel Sandbox Demo

A modern Next.js 15 application showcasing integration with Inngest for background job processing, Vercel Sandbox for secure code execution, and Inngest AgentKit for AI-powered coding assistance.

## Tech Stack

- **Next.js 15** - App Router with TypeScript
- **Tailwind CSS v4** - Zero-config styling
- **shadcn/ui** - Beautiful UI components
- **Inngest** - Background job orchestration
- **Vercel Sandbox** - Secure code execution
- **Inngest AgentKit** - AI agent framework
- **Biome.js** - Fast formatter and linter

## Features

- 🚀 Next.js 15 with App Router
- 🎨 Tailwind CSS v4 (no config file needed)
- 🧩 shadcn/ui components with dark mode
- 🔧 Inngest functions for background processing
- 🏗️ Vercel Sandbox for secure code execution
- 🤖 AI coding assistant (requires OpenAI API key)
- 📦 pnpm for fast package management
- ✨ TypeScript for type safety

## Prerequisites

- Node.js 18+
- pnpm
- Vercel account (for Sandbox)
- OpenAI API key (optional, for AI features)

## Getting Started

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your keys:
   - `INNGEST_EVENT_KEY` - Your Inngest event key
   - `OPENAI_API_KEY` - For AI agent features
   - `VERCEL_OIDC_TOKEN` - For Vercel Sandbox authentication

3. **Run Inngest Dev Server:**
   ```bash
   npx inngest-cli@latest dev
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

5. **Open your browser:**
   - App: http://localhost:3000
   - Inngest Dashboard: http://localhost:8288

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── inngest/       # Inngest webhook handler
│   │   ├── execute/       # Sandbox execution endpoint
│   │   └── agent/         # AI agent endpoint
│   ├── demo/              # shadcn/ui demo page
│   └── inngest-demo/      # Inngest integration demo
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── sandbox-demo.tsx  # Code execution demo
│   └── agent-demo.tsx    # AI assistant demo
├── lib/                   # Utilities and configuration
│   └── inngest/          # Inngest functions
└── types/                # TypeScript type definitions
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome
- `pnpm typecheck` - Run TypeScript type checking

## Demo Pages

- `/` - Home page with project overview
- `/demo` - shadcn/ui component showcase
- `/inngest-demo` - Inngest + Vercel Sandbox integration demo

## How It Works

1. **Inngest Functions** - Background jobs are processed reliably using Inngest's event-driven architecture
2. **Vercel Sandbox** - Code is executed in isolated Firecracker MicroVMs for security
3. **AgentKit** - AI agents can be configured to assist with coding tasks
4. **UI Components** - Built with shadcn/ui and Tailwind CSS v4 for a modern interface

## Deployment

1. Deploy to Vercel:
   ```bash
   vercel
   ```

2. Set up environment variables in Vercel dashboard

3. Configure Inngest webhook URL in production

## License

MIT