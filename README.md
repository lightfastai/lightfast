# Chat App with Convex

A real-time chat application built with Next.js and Convex, featuring GitHub authentication, AI responses, and a v0.dev-inspired landing page.

## Environment Variables

This project uses `@t3-oss/env-nextjs` for type-safe environment variable validation. The environment configuration is defined in `src/env.ts`.

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210  # For local development

# OpenAI API (Required for AI responses)
OPENAI_API_KEY=sk-your-openai-api-key-here

# GitHub OAuth (Required for authentication)
AUTH_GITHUB_ID=your-github-oauth-client-id
AUTH_GITHUB_SECRET=your-github-oauth-client-secret

# Node Environment
NODE_ENV=development
```

### Environment Variable Types

- **Server-only variables**: `OPENAI_API_KEY`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `NODE_ENV`
  - These are only available on the server-side and will throw an error if accessed on the client
- **Client-accessible variables**: `NEXT_PUBLIC_CONVEX_URL`
  - These are available on both server and client (must be prefixed with `NEXT_PUBLIC_`)

## Authentication Setup

This app uses GitHub OAuth for authentication. To set up authentication:

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Your app name
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

### 2. Set Environment Variables

Add the GitHub OAuth credentials to your `.env.local` file:

```bash
AUTH_GITHUB_ID=your_github_client_id_here
AUTH_GITHUB_SECRET=your_github_client_secret_here
```

### 3. Sync Environment Variables

Run the sync script to push environment variables to Convex:

```bash
pnpm env:sync
```

### Usage

Instead of accessing `process.env` directly, import and use the validated `env` object:

```typescript
// ✅ Correct - Type-safe and validated
import { env } from "@/env"
const convexUrl = env.NEXT_PUBLIC_CONVEX_URL

// ❌ Incorrect - No type safety or validation
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
```

### Skipping Validation

For Docker builds or CI/CD where environment validation might interfere, you can skip validation:

```bash
SKIP_ENV_VALIDATION=true npm run build
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up your environment variables (create `.env.local` with the variables shown above)

3. Set up GitHub OAuth (see Authentication Setup section above)

4. Sync environment variables to Convex:
   ```bash
   pnpm env:sync
   ```

5. Start the Convex development server:
   ```bash
   pnpm convex:dev
   ```

6. In a new terminal, start the Next.js development server:
   ```bash
   pnpm dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) and sign in with GitHub

## Features

- ✅ **v0.dev-inspired landing page** - Clean, modern design with centered textarea
- ✅ **GitHub Authentication** - Secure login with Convex Auth
- ✅ **Real-time AI Chat** - Streaming responses with GPT-4o-mini
- ✅ **Thread Management** - Organized conversations with persistent history
- ✅ **Real-time Updates** - Live message updates with Convex
- ✅ **Type-safe Environment Variables** - Validated with `@t3-oss/env-nextjs`
- ✅ **Next.js 15 Canary** - Latest features with App Router and PPR
- ✅ **Modern UI** - Built with shadcn/ui and Tailwind CSS

## Architecture

- **Frontend**: Next.js 15 Canary with App Router + PPR
- **Backend**: Convex for real-time database and API
- **Type Safety**: TypeScript with validated environment variables
- **Styling**: Tailwind CSS (configured via `@/components/ui`)
- **Performance**: PPR for optimal static/dynamic content rendering

## Environment Validation Benefits

1. **Build-time validation**: Catches missing environment variables before deployment
2. **Type safety**: Full TypeScript intellisense for environment variables
3. **Runtime safety**: Prevents access to server variables on the client
4. **Transform support**: Use Zod transforms and default values
5. **Clear errors**: Descriptive error messages for debugging

## Tech Stack

- **Next.js 15** - React framework with App Router
- **Convex** - Real-time backend with database, auth, and functions
- **Biome** - Fast formatter and linter
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript

## Available Scripts

- `npm run dev` - Start the Next.js development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run Biome linter and fix issues
- `npm run format` - Format code with Biome
- `npm run convex:dev` - Start Convex development server
- `npm run convex:deploy` - Deploy to Convex

## Project Structure

```
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── components/     # React components
│   └── lib/           # Utility functions
├── convex/            # Convex backend functions
│   ├── schema.ts      # Database schema
│   └── messages.ts    # Message functions
├── public/            # Static assets
└── package.json       # Dependencies and scripts
```

## Development

The project uses Biome for code formatting and linting. Run these commands to maintain code quality:

```bash
# Format all files
npm run format

# Lint and fix issues
npm run lint
```

## Deployment

1. Deploy your Convex functions:
   ```bash
   npm run convex:deploy
   ```

2. Deploy your Next.js app to your preferred platform (Vercel, Netlify, etc.)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Biome Documentation](https://biomejs.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
