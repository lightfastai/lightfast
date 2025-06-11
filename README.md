# Chat App

A modern chat application built with Next.js, Convex, and Biome.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **Convex** - Real-time backend with database, auth, and functions
- **Biome** - Fast formatter and linter
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript

## Getting Started

### Prerequisites

- Node.js (18 or later)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development servers:
   ```bash
   # Start Convex dev server
   npm run convex:dev
   
   # In another terminal, start Next.js dev server
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

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