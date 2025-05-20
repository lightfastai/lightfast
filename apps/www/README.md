# Lightfast - AI Workflow Assistant Platform for Creative Professionals

## Overview

Lightfast is an AI-powered workflow assistant platform that integrates with various creative tools to streamline and accelerate professional workflows. Built with Next.js 15.3 and React 19, it implements a modern, secure, and performant architecture for enhancing creative workflows across multiple software environments.

## Key Features

- Deep Integration with Creative Software (Blender, TouchDesigner, Unity, Unreal, etc.)
- Context-Aware AI Assistance
- Unified Asset Management
- Task Automation Engine
- Cross-Software Consistency

## Architecture

### Tech Stack

- Next.js 15.3 with TypeScript configuration
- React 19 with Server Components
- Enhanced type safety with Zod 3.24.0
- Updated environment variable handling with @t3-oss/env-nextjs 0.12.0

### Core Components

#### Creative Software Integration

- Socket-based communication with creative applications
- Tool-specific adapters and plugins
- Bidirectional data exchange

#### AI Assistant System

- Multi-agent architecture for specialized tasks
- Integration with multiple AI providers
- Context-aware assistance

#### Asset Management

- Unified search across asset platforms
- Direct integration with Polyhaven, AmbientCG, etc.
- Asset transformation and preparation

#### Task Automation

- Tool-specific code generation
- Workflow recording and playback
- Batch processing capabilities

### Implementation Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── api/
│           └── integrations/
│               ├── blender/           # Blender integration endpoints
│               └── touchdesigner/     # TouchDesigner integration endpoints
├── lib/
│   └── agents/                       # AI agent implementations
├── config/                           # Configuration files
├── components/                       # React components
└── env.ts                            # Environment configuration
```

## Development

### Prerequisites

- Node.js 20.x
- pnpm 8.x

### Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Testing

The application includes comprehensive testing:

- Unit tests for core functionality
- Integration tests for API endpoints
- E2E tests for critical user flows

## Deployment

The application is configured for deployment on Vercel with:

- Edge Runtime support
- Automated CI/CD pipeline
- Environment variable validation
- Build-time type checking

## Security Considerations

- All API routes are protected with Arcjet rate limiting
- Authentication state is managed securely through Clerk
- Environment variables are strictly typed and validated
- Security headers are configured for production
- CORS is properly configured for API routes

## Monitoring & Analytics

- Integration with analytics for user tracking
- Error monitoring and reporting
- Performance metrics collection
- User engagement tracking

This package is private and part of the React TD monorepo.
