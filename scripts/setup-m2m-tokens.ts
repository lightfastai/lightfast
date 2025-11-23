#!/usr/bin/env tsx
/**
 * One-time M2M Token Setup Script
 *
 * This script generates long-lived M2M tokens for webhook and inngest services.
 * Run this ONCE during initial setup after creating machines in Clerk Dashboard.
 *
 * Prerequisites:
 * 1. Create 3 machines in Clerk Dashboard:
 *    - "tRPC API"
 *    - "Webhook Handler"
 *    - "Inngest Workflows"
 *
 * 2. Configure scopes in Dashboard:
 *    - Webhook Handler → can communicate with → tRPC API
 *    - Inngest Workflows → can communicate with → tRPC API
 *    - tRPC API → can communicate with → Webhook Handler, Inngest Workflows
 *
 * 3. Copy machine secret keys from Dashboard:
 *    - Webhook Handler machine secret → CLERK_MACHINE_SECRET_KEY_WEBHOOK
 *    - Inngest Workflows machine secret → CLERK_MACHINE_SECRET_KEY_INNGEST
 *
 * 4. Set environment variables and run:
 *    ```bash
 *    CLERK_MACHINE_SECRET_KEY_WEBHOOK=ak_xxx \
 *    CLERK_MACHINE_SECRET_KEY_INNGEST=ak_xxx \
 *    pnpm tsx scripts/setup-m2m-tokens.ts
 *    ```
 *
 * This will output the tokens and machine IDs to add to your .env files.
 */

import { createClerkClient } from "@clerk/backend";

async function setupM2MTokens() {
  const webhookSecretKey = process.env.CLERK_MACHINE_SECRET_KEY_WEBHOOK;
  const inngestSecretKey = process.env.CLERK_MACHINE_SECRET_KEY_INNGEST;

  if (!webhookSecretKey || !inngestSecretKey) {
    console.error("❌ Missing required environment variables:");
    console.error("   - CLERK_MACHINE_SECRET_KEY_WEBHOOK");
    console.error("   - CLERK_MACHINE_SECRET_KEY_INNGEST");
    console.error("\nGet these from Clerk Dashboard → Machines → View machine secret");
    process.exit(1);
  }

  console.log("🔐 Generating long-lived M2M tokens (365 days)...\n");

  const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  try {
    // Generate webhook token
    console.log("📡 Creating Webhook Handler token...");
    const webhookToken = await clerk.m2m.createToken({
      machineSecretKey: webhookSecretKey,
      secondsUntilExpiration: 31536000, // 365 days
    });

    console.log("✅ Webhook token created");
    console.log(`   Token ID: ${webhookToken.id}`);
    console.log(`   Machine ID: ${webhookToken.subject}`);
    console.log(`   Expires: ${new Date(webhookToken.expiration!).toISOString()}\n`);

    // Generate inngest token
    console.log("⚙️  Creating Inngest Workflows token...");
    const inngestToken = await clerk.m2m.createToken({
      machineSecretKey: inngestSecretKey,
      secondsUntilExpiration: 31536000, // 365 days
    });

    console.log("✅ Inngest token created");
    console.log(`   Token ID: ${inngestToken.id}`);
    console.log(`   Machine ID: ${inngestToken.subject}`);
    console.log(`   Expires: ${new Date(inngestToken.expiration!).toISOString()}\n`);

    // Output environment variables
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 Add these to your .env files:\n");
    console.log("# Webhook Machine");
    console.log(`CLERK_M2M_TOKEN_WEBHOOK=${webhookToken.token}`);
    console.log(`CLERK_M2M_MACHINE_ID_WEBHOOK=${webhookToken.subject}\n`);
    console.log("# Inngest Machine");
    console.log(`CLERK_M2M_TOKEN_INNGEST=${inngestToken.token}`);
    console.log(`CLERK_M2M_MACHINE_ID_INNGEST=${inngestToken.subject}\n`);
    console.log("# tRPC Machine (get from Dashboard)");
    console.log("CLERK_MACHINE_SECRET_KEY_TRPC=ak_xxx");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("⚠️  IMPORTANT:");
    console.log("   - Store these tokens securely");
    console.log("   - They expire in 365 days");
    console.log("   - You can revoke them anytime in Clerk Dashboard");
    console.log("   - Set up calendar reminder to regenerate before expiration\n");

  } catch (error) {
    console.error("❌ Failed to create M2M tokens:");
    console.error(error);
    process.exit(1);
  }
}

setupM2MTokens();
