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
- **T3 Env** - Type-safe environment variables with Zod validation

## Features

- 🚀 Next.js 15 with App Router
- 🎨 Tailwind CSS v4 (no config file needed)
- 🧩 shadcn/ui components with dark mode
- 🔧 Inngest functions for background processing
- 🏗️ Vercel Sandbox for secure code execution
- 🤖 AI coding assistant powered by Claude 3.7 Sonnet via Vercel AI Gateway
- 📦 pnpm for fast package management
- ✨ TypeScript for type safety
- 🔐 Type-safe environment variables with T3 Env

## Prerequisites

- Node.js 18+
- pnpm
- Vercel account (required for Sandbox and AI Gateway)

## Getting Started

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your keys (optional):
   - `INNGEST_EVENT_KEY` - Your Inngest event key
   - `INNGEST_SIGNING_KEY` - Your Inngest signing key
   
   - `AI_GATEWAY_API_KEY` - Your AI Gateway API key from Vercel dashboard
   
   Environment variables are validated at build time using T3 Env and Zod schemas.

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
│   │   ├── investigation/ # Investigation chat endpoints
│   │   └── agent/         # AI agent endpoint
│   ├── demo/              # shadcn/ui demo page
│   ├── inngest-demo/      # Inngest integration demo
│   └── investigation/     # Code investigation chat UI
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── sandbox-demo.tsx  # Code execution demo
│   ├── agent-demo.tsx    # AI assistant demo
│   └── investigation-chat.tsx # Investigation chat interface
├── lib/                   # Utilities and configuration
│   └── inngest/          # Inngest functions
├── types/                # TypeScript type definitions
└── env.ts                # T3 Env configuration with Zod schemas
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
- `/investigation` - AI-powered code investigation chat
- `/security` - TypeScript security best practices dashboard

## How It Works

1. **Inngest Functions** - Background jobs are processed reliably using Inngest's event-driven architecture
2. **Vercel Sandbox** - Code is executed in isolated Firecracker MicroVMs for security
3. **AgentKit** - AI agents can be configured to assist with coding tasks
4. **UI Components** - Built with shadcn/ui and Tailwind CSS v4 for a modern interface

## Security Features

The Code Security Agent focuses on TypeScript security best practices:

### 🔒 Security Analysis Capabilities

- **Type Safety Analysis**: Detects usage of `any`, unsafe type assertions, and weak typing patterns
- **Vulnerability Detection**: Identifies SQL injection, XSS, CSRF, and other common vulnerabilities
- **Authentication Auditing**: Reviews JWT implementation, session management, and access controls
- **Data Validation**: Checks for proper input sanitization and schema validation
- **Cryptography Review**: Identifies weak algorithms, hardcoded secrets, and insecure randomness

### TypeScript Security Best Practices

1. **Enable Strict Mode**: Use TypeScript's strict compiler options for maximum type safety
2. **Avoid `any` Type**: Replace with specific types, `unknown`, or generics
3. **Runtime Validation**: Use Zod or similar libraries for runtime type checking
4. **Secure Error Handling**: Never expose internal error details to users
5. **Type-Safe Middleware**: Create properly typed authentication and authorization middleware

### Running Security Analysis

To analyze a repository for security issues:

1. Navigate to `/investigation`
2. Enter the repository URL
3. Use security-focused queries like:
   - "Perform a comprehensive security audit with TypeScript best practices"
   - "Find all instances of unsafe type assertions and any usage"
   - "Check for SQL injection, XSS, and other vulnerabilities"

The agent will generate custom security scanning scripts and provide actionable recommendations.

## Deployment

1. Deploy to Vercel:
   ```bash
   vercel
   ```

2. Set up environment variables in Vercel dashboard

3. Configure Inngest webhook URL in production

## License

MIT