# Deployment Guide

This document explains how to deploy the Lightfast Chat application to Vercel with Convex backend integration.

## Architecture Overview

- **Local Development**: `localhost:3000` + `127.0.0.1:3210` (Convex local)
- **Preview Deployments**: Branch-based with auto-generated Convex backends
- **Production**: Stable main branch deployment with production Convex backend

## Vercel Setup Instructions

### 1. Create Vercel Project

1. Go to [Vercel](https://vercel.com/new)
2. Import your GitHub repository
3. Configure the project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (if in root)
   - **Build Command**: Will be set automatically from `vercel.json`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

### 2. Environment Variables Setup

#### Production Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `CONVEX_DEPLOY_KEY` | [Production Deploy Key from Convex Dashboard] | Production |
| `NEXT_PUBLIC_APP_ENV` | `production` | Production |

#### Preview Environment Variables

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `CONVEX_DEPLOY_KEY` | [Preview Deploy Key from Convex Dashboard] | Preview |
| `NEXT_PUBLIC_APP_ENV` | `preview` | Preview |

### 3. Get Convex Deploy Keys

#### Production Deploy Key
1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select your project
3. Go to Settings
4. Click "Generate Production Deploy Key"
5. Copy the key and add to Vercel environment variables

#### Preview Deploy Key
1. In the same Convex Dashboard Settings
2. Click "Generate Preview Deploy Key"
3. Copy the key and add to Vercel environment variables

### 4. Configure Build Commands

The build commands are configured in `vercel.json`:

- **Production**: `npx convex deploy --cmd 'pnpm build'`
- **Preview**: `npx convex deploy --cmd 'pnpm build' --preview-run 'setup:setupInitialData'`

Preview deployments will automatically get fresh test data via the `setupInitialData` function.

## Deployment Workflow

### Automatic Deployments

1. **Production**: Push to `main` branch triggers production deployment
2. **Preview**: Open a PR triggers preview deployment with fresh Convex backend

### Manual Deployments

```bash
# Deploy to preview (current branch)
pnpm run deploy:preview

# Deploy to production (merge to main)
pnpm run deploy:prod
```

## Environment Variables Management

### Local to Convex Sync

```bash
# Sync local .env.local to Convex development environment
pnpm run env:sync

# Check synced variables
pnpm run env:check
```

### Required Variables

Create `.env.local` with:

```env
# Convex (auto-generated in development)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210

# AI Integration (required)
OPENAI_API_KEY=your_openai_key_here

# Optional AI providers
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here

# Environment identifier
NEXT_PUBLIC_APP_ENV=development
```

## Monitoring & Debugging

### Deployment Logs

- **Vercel**: Check deployment logs in Vercel Dashboard
- **Convex**: Check function logs in Convex Dashboard

### Environment Validation

The app uses `@t3-oss/env-nextjs` for type-safe environment validation. Check `src/env.ts` for current requirements.

### Preview Deployment Features

- Fresh Convex backend for each preview
- Automatic test data setup
- Isolated from production data
- 14-day auto-cleanup

## Troubleshooting

### Common Issues

1. **Build fails with Convex errors**
   - Check `CONVEX_DEPLOY_KEY` is set correctly
   - Verify key scope (Production vs Preview)

2. **Environment variables not loading**
   - Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side
   - Check environment scope in Vercel settings

3. **Preview deployments missing data**
   - Verify `setup:setupInitialData` function exists
   - Check build command includes `--preview-run`

### Support

- [Convex Documentation](https://docs.convex.dev/)
- [Vercel Documentation](https://vercel.com/docs)
- [Project Repository Issues](https://github.com/lightfastai/chat/issues)
