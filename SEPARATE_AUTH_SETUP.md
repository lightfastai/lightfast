# Separate Authentication Setup Guide

This guide walks you through setting up separate authentication for the Chat and Cloud applications.

## Overview

The authentication separation allows:
- **Chat App** (`apps/chat`): Independent authentication for chat users 
- **Cloud App** (`apps/cloud`): Separate authentication for cloud platform users
- **Auth App** (`apps/auth`): Dedicated authentication service that redirects to cloud app

## Prerequisites

1. Two separate Clerk applications (one for chat, one for cloud/auth)
2. Separate database configurations for each app
3. Environment variables configured for each app

## Step 1: Create Clerk Applications

### Chat App Clerk Setup
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application named "Lightfast Chat"
3. Configure authentication methods (email, social, etc.)
4. Note the publishable key (starts with `pk_test_` or `pk_live_`)
5. Note the secret key (starts with `sk_test_` or `sk_live_`)

### Cloud App Clerk Setup
1. Create another Clerk application named "Lightfast Cloud"
2. Configure authentication methods 
3. Note the publishable key and secret key

## Step 2: Environment Configuration

### Chat App Environment
Copy `apps/chat/.env.local.example` to `apps/chat/.env.local`:

```bash
cp apps/chat/.env.local.example apps/chat/.env.local
```

Edit `apps/chat/.env.local` with your Chat Clerk credentials:

```env
# Clerk Configuration for Chat App
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_chat_publishable_key
CLERK_SECRET_KEY=sk_test_your_chat_secret_key

# Clerk URLs for Chat App
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Chat App URL
NEXT_PUBLIC_APP_URL=http://localhost:4106

# Add other required environment variables...
```

### Cloud App Environment
Copy `apps/cloud/.env.local.example` to `apps/cloud/.env.local`:

```bash
cp apps/cloud/.env.local.example apps/cloud/.env.local
```

Edit `apps/cloud/.env.local` with your Cloud Clerk credentials:

```env
# Clerk Configuration for Cloud App
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_cloud_publishable_key
CLERK_SECRET_KEY=sk_test_your_cloud_secret_key

# Cloud App URL
NEXT_PUBLIC_APP_URL=http://localhost:4103

# Add other required environment variables...
```

### Auth App Environment
The auth app redirects to the cloud app, so it uses the same Clerk credentials as the cloud app.

Copy `apps/auth/.env.local.example` to `apps/auth/.env.local`:

```bash
cp apps/auth/.env.local.example apps/auth/.env.local
```

Use the same Cloud Clerk credentials in `apps/auth/.env.local`.

## Step 3: Database Configuration

### Chat Database
The chat app uses its own database configuration in `db/chat/env.ts`.

Add to `apps/chat/.env.local`:

```env
# Chat Database Configuration
DATABASE_HOST=your-chat-database-host
DATABASE_USERNAME=your-chat-database-username
DATABASE_PASSWORD=your-chat-database-password
```

### Cloud Database
The cloud app uses its database configuration in `db/cloud/env.ts`.

Add to `apps/cloud/.env.local`:

```env
# Cloud Database Configuration
DATABASE_HOST=your-cloud-database-host
DATABASE_USERNAME=your-cloud-database-username
DATABASE_PASSWORD=your-cloud-database-password
```

## Step 4: Test the Setup

### Start Development Servers

Start each app on its designated port:

```bash
# Terminal 1 - Chat App (port 4106)
cd apps/chat
pnpm dev

# Terminal 2 - Cloud App (port 4103)
cd apps/cloud
pnpm dev

# Terminal 3 - Auth App (port 4104)
cd apps/auth
pnpm dev
```

### Test Authentication Flows

1. **Chat App**: Navigate to http://localhost:4106
   - Try signing up/in - should use chat Clerk app
   - Users should stay within chat app after authentication

2. **Cloud App**: Navigate to http://localhost:4103
   - Try signing up/in - should use cloud Clerk app
   - Users should be redirected to dashboard after authentication

3. **Auth App**: Navigate to http://localhost:4104
   - Should redirect to cloud app authentication
   - Uses same Clerk app as cloud app

## Step 5: Verification

### Verify Separate User Bases
1. Create a test user in the Chat app
2. Create a test user in the Cloud app with the same email
3. Verify they are separate accounts in respective Clerk dashboards

### Verify Authentication Flows
- Chat users can only access chat features
- Cloud users can only access cloud features
- Authentication is completely separate between apps

## Current Status

✅ **Completed:**
- Environment configuration files created
- Separate Clerk environment variables configured
- Database separation maintained
- Authentication routes set up in chat app
- Middleware updated for independent auth flows

⚠️ **Known Issues:**
- Chat app has TypeScript errors due to Lightfast dependency issues
- These don't affect authentication setup but need to be resolved separately

🔄 **Next Steps:**
- Set up actual Clerk applications
- Configure environment variables with real credentials
- Test authentication flows end-to-end
- Deploy and test in production environments

## Port Configuration

- **Chat App**: http://localhost:4106
- **Cloud App**: http://localhost:4103
- **Auth App**: http://localhost:4104 (redirects to Cloud)
- **WWW App**: http://localhost:4101

## Troubleshooting

### Environment Variables Not Loading
- Ensure `.env.local` files are in the correct app directories
- Check that variable names match exactly
- Restart development servers after changing environment variables

### Authentication Redirects Not Working
- Verify Clerk URLs are configured correctly
- Check that middleware is properly set up
- Ensure publishable keys match between Clerk dashboard and environment variables

### Database Connection Issues
- Verify database credentials are correct
- Ensure database hosts are accessible
- Check that separate databases are configured for chat vs cloud