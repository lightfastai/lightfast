# Inngest + Vercel Sandbox + AgentKit Integration

This project demonstrates how to integrate Inngest, Vercel Sandbox, and AgentKit to create powerful serverless functions with secure code execution and AI capabilities.

## Setup Instructions

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

Then fill in your credentials:
- `INNGEST_EVENT_KEY`: Your Inngest event key (get from Inngest dashboard)
- `INNGEST_SIGNING_KEY`: Your Inngest signing key
- `OPENAI_API_KEY`: Your OpenAI API key (for AgentKit)

### 3. Run the Inngest Dev Server

In a separate terminal, run:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest dev server at `http://localhost:8288`

### 4. Start the Next.js Development Server

```bash
pnpm dev
```

### 5. Access the Demo

Visit `http://localhost:3000/inngest-demo` to see the integration in action.

## Architecture Overview

### Components

1. **Inngest Client** (`/lib/inngest/client.ts`)
   - Configures the Inngest client for sending and receiving events

2. **Inngest Functions** (`/lib/inngest/functions/`)
   - `sandbox-function.ts`: Executes code in Vercel Sandbox
   - `agent-function.ts`: AI coding assistant using AgentKit

3. **API Routes**
   - `/api/inngest`: Inngest webhook handler
   - `/api/execute`: Triggers sandbox code execution
   - `/api/agent`: Triggers AI agent queries

4. **UI Components**
   - `SandboxDemo`: Interface for code execution
   - `AgentDemo`: Interface for AI coding assistant

## How It Works

1. **Code Execution Flow**:
   - User submits code through the UI
   - API route sends event to Inngest
   - Inngest function creates a Vercel Sandbox
   - Code executes in isolated environment
   - Results are returned (in production, via webhooks)

2. **AI Agent Flow**:
   - User submits a coding question
   - API route sends event to Inngest
   - Agent processes query with access to sandbox
   - Agent can write and test code automatically
   - Response is returned with working code examples

## Production Deployment

1. Deploy to Vercel:
   ```bash
   vercel deploy
   ```

2. Set environment variables in Vercel dashboard

3. Configure Inngest webhook URL in Inngest dashboard:
   ```
   https://your-app.vercel.app/api/inngest
   ```

## Security Notes

- All code execution happens in isolated Vercel Sandbox containers
- Each execution gets a fresh environment
- Sandboxes are automatically cleaned up after execution
- API routes should include authentication in production

## Extending the Demo

- Add more languages to the sandbox executor
- Implement webhook handlers for real-time results
- Add authentication and user management
- Store execution history in a database
- Add more AI agent capabilities