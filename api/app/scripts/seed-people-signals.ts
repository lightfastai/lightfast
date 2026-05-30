/**
 * Dev-only seed: creates people-mentioning signals in a target org so the real
 * pipeline (classify-signal -> classify-people) populates the People surface.
 *
 * Requires the local stack running (`pnpm dev` with local Inngest + AI creds)
 * and DATABASE_* env pointed at the target org's branch. Nondeterministic:
 * the AI does the extraction, so verify results at /<slug>/people afterward.
 *
 * Run from api/app:
 *   SEED_CLERK_ORG_ID=org_xxx SEED_CREATED_BY_USER_ID=user_xxx \
 *     pnpm with-env tsx scripts/seed-people-signals.ts
 */
import { db } from "@db/app/client";
import { createAndQueueSignal } from "../src/signals/create-signal";

const SEED_INPUTS = [
  "Reply to rauchg@vercel.com about the microfrontends partnership proposal.",
  "DM @leerob on X about the App Router demo we promised for next week.",
  "Follow up with sarah@netlify.com after the edge functions call on Thursday.",
  "Review github.com/shadcn feedback on the dialog primitive PR.",
  "Connect with linkedin.com/in/leerob about the DX advocate role.",
  "Email support@planetscale.com about the Vitess branch quota increase.",
  "Ping @theo on X to coordinate the t3 stack collab stream.",
  "Schedule an intro call with hello@resend.com about transactional email.",
  "Thank Sarah Drasner (sarah@netlify.com) for the conference shoutout.",
  "Ask jamie@upstash.com about Redis rate-limit pricing for our tier.",
  "Loop in guillermo (rauchg@vercel.com) on the enterprise SSO thread.",
  "Reach out to @shuding_ on X about the Next.js cache components feedback.",
];

async function main() {
  const clerkOrgId = process.env.SEED_CLERK_ORG_ID;
  const createdByUserId = process.env.SEED_CREATED_BY_USER_ID;

  if (!clerkOrgId || !createdByUserId) {
    throw new Error(
      "Set SEED_CLERK_ORG_ID and SEED_CREATED_BY_USER_ID env vars before seeding."
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeding ${SEED_INPUTS.length} signals into org ${clerkOrgId}...`
  );

  for (const input of SEED_INPUTS) {
    const result = await createAndQueueSignal(db, {
      clerkOrgId,
      createdByApiKeyId: null,
      createdByUserId,
      input,
    });
    // eslint-disable-next-line no-console
    console.log(`  queued ${result.id}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    "Done. Watch the Inngest dashboard / dev logs for classify-people, then check /<slug>/people."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
