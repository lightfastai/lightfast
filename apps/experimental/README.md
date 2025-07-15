# Next.js 15 + Inngest + Vercel Sandbox Demo

> 🧪 Test change made in container-use environment: enabling-coral

A modern Next.js 15 application showcasing integration with Inngest for background job processing, Vercel Sandbox for secure code execution, and Inngest AgentKit for AI-powered coding assistance.

## Tech Stack

- **Next.js 15** - App Router with TypeScript
- **Tailwind CSS v4** - Zero-config styling
- **shadcn/ui** - Beautiful UI components
- **Inngest** - Background job orchestration
- **Vercel Sandbox** - Secure code execution
- **Inngest AgentKit** - AI assistance
- **Vercel Postgres** - Database (optional)

## Features

### 🤖 AI Code Assistant
- **Talk to Codebase**: Natural language interface to interact with your code
- **Code Generation**: AI-powered code suggestions and generation
- **Context-Aware**: Understands your project structure and dependencies

### 🔄 Background Jobs
- **Scheduled Tasks**: Run jobs on a schedule
- **Event-Driven**: Trigger jobs from API calls or other events
- **Reliable Execution**: Built-in retries and error handling
- **Real-time Monitoring**: Track job status in Inngest dashboard

### 🏖️ Vercel Sandbox
- **Safe Execution**: Run untrusted code in isolated environments
- **Multiple Runtimes**: Support for Node.js, Python, and more
- **Resource Limits**: Control CPU, memory, and execution time
- **File System Access**: Read/write files within the sandbox

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Vercel account (for deployment)
- Inngest account (free tier available)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables:
```env
# Inngest
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Vercel Postgres (optional)
POSTGRES_URL=your_postgres_url
```

### Development

1. Start the Inngest dev server:
```bash
pnpm inngest:dev
```

2. In a new terminal, start the Next.js development server:
```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/                  # Next.js 15 app directory
│   ├── api/             # API routes
│   │   └── inngest/     # Inngest endpoint
│   ├── (dashboard)/     # Dashboard routes
│   └── layout.tsx       # Root layout
├── components/          # React components
├── inngest/            # Inngest functions
│   ├── functions/      # Individual job definitions
│   └── client.ts       # Inngest client setup
├── lib/                # Utility functions
└── public/             # Static assets
```

## Key Components

### Inngest Integration

The Inngest integration is set up in `app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
```

### Background Jobs

Example background job in `inngest/functions/example.ts`:

```typescript
export const exampleJob = inngest.createFunction(
  { id: "example-job" },
  { event: "example/job.triggered" },
  async ({ event, step }) => {
    // Your job logic here
  }
);
```

### Vercel Sandbox Usage

Example sandbox execution:

```typescript
import { Sandbox } from '@vercel/sandbox';

const sandbox = await Sandbox.create();
const result = await sandbox.run('console.log("Hello from sandbox!")');
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables
4. Deploy!

### Configure Inngest

1. Sign up at [inngest.com](https://inngest.com)
2. Create a new app
3. Add your production URL + `/api/inngest` as the endpoint
4. Update your environment variables with production keys

## Development Tips

- Use the Inngest dev UI at `http://localhost:8288` to test and debug functions
- Check the Vercel Functions logs for API route debugging
- Use the browser DevTools for frontend debugging

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Vercel Sandbox Documentation](https://vercel.com/docs/functions/sandbox)
- [Inngest AgentKit](https://www.inngest.com/docs/agent-kit)

## License

MIT