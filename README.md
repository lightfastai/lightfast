# Chat App with Convex

A real-time chat application built with Next.js and Convex, featuring type-safe environment variables using `@t3-oss/env-nextjs`.

## Environment Variables

This project uses `@t3-oss/env-nextjs` for type-safe environment variable validation. The environment configuration is defined in `src/env.ts`.

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Convex Configuration
CONVEX_DEPLOYMENT=your-convex-deployment-name
NEXT_PUBLIC_CONVEX_URL=your-convex-url

# Optional: OpenAI API Key for AI functionality
OPENAI_API_KEY=your_openai_api_key_here

# Node Environment
NODE_ENV=development
```

### Environment Variable Types

- **Server-only variables**: `CONVEX_DEPLOYMENT`, `OPENAI_API_KEY`, `NODE_ENV`
  - These are only available on the server-side and will throw an error if accessed on the client
- **Client-accessible variables**: `NEXT_PUBLIC_CONVEX_URL`
  - These are available on both server and client (must be prefixed with `NEXT_PUBLIC_`)

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

2. Set up your environment variables (copy `.env.example` to `.env.local`)

3. Start the Convex development server:
   ```bash
   npx convex dev
   ```

4. Start the Next.js development server:
   ```bash
   pnpm dev
   ```

## Features

- ✅ Type-safe environment variables with `@t3-oss/env-nextjs`
- ✅ Real-time chat with Convex
- ✅ Next.js 15 Canary with App Router
- ✅ **PPR (Partial Prerendering)** - Latest Next.js experimental feature
- ✅ TypeScript support
- ✅ Build-time environment validation

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
