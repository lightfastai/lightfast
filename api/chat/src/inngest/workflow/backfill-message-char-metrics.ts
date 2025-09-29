import { inngest } from "../client/client";
import { db } from "@db/chat/client";
import { LightfastChatMessage } from "@db/chat";
import { computeMessageCharCount } from "@repo/chat-ai-types";
import { eq, or, isNull } from "drizzle-orm";

const BATCH_SIZE = 200;

export const backfillMessageCharMetrics = inngest.createFunction(
  {
    id: "apps-chat.backfill-message-char-metrics",
    name: "Backfill message character metrics",
    concurrency: { limit: 1 },
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    let processed = 0;

    while (true) {
      const batch = await step.run("fetch-message-batch", async () => {
        return db
          .select({
            id: LightfastChatMessage.id,
            parts: LightfastChatMessage.parts,
            charCount: LightfastChatMessage.charCount,
          })
          .from(LightfastChatMessage)
          .where(
            or(
              isNull(LightfastChatMessage.charCount),
              eq(LightfastChatMessage.charCount, 0),
            ),
          )
          .limit(BATCH_SIZE);
      });

      if (batch.length === 0) {
        break;
      }

      await step.run("update-message-metrics", async () => {
        await Promise.all(
          batch.map(async (message) => {
            const metrics = computeMessageCharCount(
              message.parts as Parameters<typeof computeMessageCharCount>[0],
            );

            await db
              .update(LightfastChatMessage)
              .set({
                charCount: metrics.charCount,
                tokenCount: metrics.tokenCount ?? null,
              })
              .where(eq(LightfastChatMessage.id, message.id));
          }),
        );
      });

      processed += batch.length;

      if (batch.length < BATCH_SIZE) {
        break;
      }
    }

    return { processed };
  },
);
