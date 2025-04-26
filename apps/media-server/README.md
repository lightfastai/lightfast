# Media Server

A simple Express-based media server for serving images from Cloudflare R2, ready for deployment on Koyeb.

## Setup

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in your Cloudflare R2 credentials:

   ```sh
   cp .env.example .env
   ```

3. Run the server in development:
   ```sh
   pnpm dev
   ```

## Environment Variables

- `R2_ACCESS_KEY_ID` - Your Cloudflare R2 Access Key ID
- `R2_SECRET_ACCESS_KEY` - Your Cloudflare R2 Secret Access Key
- `R2_BUCKET` - Your R2 bucket name
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `PORT` - Port to run the server (default: 3000)

## Endpoints

- `GET /images/:key` - Serve an image from R2 by key

## Deployment

- Build: `pnpm build`
- Start: `pnpm start`

Deploy to Koyeb using Docker or Git integration.
