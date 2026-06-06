import type { AppEnv, Context, Hono, Store } from "@emulators/core";

import { X_EMULATOR_FIXTURES } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";
import type { XPostRow } from "./posts";

type JsonObject = Record<string, unknown>;

async function socialWrite(
  c: Context<AppEnv>,
  store: Store,
  handler: (body: JsonObject) => Response
): Promise<Response> {
  if (!isValidBearer(c, store)) {
    return c.json({ title: "Unauthorized", status: 401 }, 401);
  }
  if (getFailures(store).socialWrite) {
    return c.json({ title: "Internal Error", status: 500 }, 500);
  }

  const body = (await c.req.json().catch(() => ({}))) as JsonObject;
  return handler(body);
}

function stringBody(body: JsonObject, key: string, fallback = "") {
  const value = body[key];
  return typeof value === "string" ? value : fallback;
}

function booleanBody(body: JsonObject, key: string, fallback: boolean) {
  const value = body[key];
  return typeof value === "boolean" ? value : fallback;
}

function createPost(store: Store, text: string) {
  const posts = store.collection<XPostRow>("posts");
  const tweetId = `tweet_${posts.count() + 1}`;
  posts.insert({
    author_id: X_EMULATOR_FIXTURES.userId,
    text,
    tweet_id: tweetId,
  });
  return { id: tweetId, text };
}

function deletePost(store: Store, tweetId: string) {
  const posts = store.collection<XPostRow>("posts");
  const post = posts.all().find((item) => item.tweet_id === tweetId);
  if (post) {
    posts.delete(post.id);
  }
  return { deleted: true };
}

export function registerSocialWrites(app: Hono<AppEnv>, store: Store): void {
  app.post("/2/tweets", (c) =>
    socialWrite(c, store, (body) =>
      c.json({ data: createPost(store, stringBody(body, "text")) }, 200)
    )
  );

  app.delete("/2/tweets/:id", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: deletePost(store, c.req.param("id")) }, 200)
    )
  );

  app.post("/2/users/:source_user_id/retweets", (c) =>
    socialWrite(c, store, () => c.json({ data: { retweeted: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/retweets/:source_tweet_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { retweeted: false } }, 200))
  );

  app.put("/2/tweets/:tweet_id/hidden", (c) =>
    socialWrite(c, store, (body) =>
      c.json({ data: { hidden: booleanBody(body, "hidden", true) } }, 200)
    )
  );

  app.post("/2/users/:source_user_id/likes", (c) =>
    socialWrite(c, store, () => c.json({ data: { liked: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/likes/:tweet_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { liked: false } }, 200))
  );

  app.post("/2/users/:source_user_id/bookmarks", (c) =>
    socialWrite(c, store, () => c.json({ data: { bookmarked: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/bookmarks/:tweet_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { bookmarked: false } }, 200))
  );

  app.post("/2/users/:source_user_id/following", (c) =>
    socialWrite(c, store, () => c.json({ data: { following: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/following/:target_user_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { following: false } }, 200))
  );

  app.post("/2/users/:source_user_id/muting", (c) =>
    socialWrite(c, store, () => c.json({ data: { muting: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/muting/:target_user_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { muting: false } }, 200))
  );

  app.post("/2/users/:source_user_id/blocking", (c) =>
    socialWrite(c, store, () => c.json({ data: { blocking: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/blocking/:target_user_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { blocking: false } }, 200))
  );

  app.post("/2/users/:user_id/dm/block", (c) =>
    socialWrite(c, store, () => c.json({ data: { dm_blocking: true } }, 200))
  );

  app.post("/2/users/:user_id/dm/unblock", (c) =>
    socialWrite(c, store, () => c.json({ data: { dm_blocking: false } }, 200))
  );

  app.post("/2/lists", (c) =>
    socialWrite(c, store, (body) =>
      c.json(
        {
          data: {
            id: `list_${store.collection("lists").count() + 1}`,
            name: stringBody(body, "name"),
          },
        },
        200
      )
    )
  );

  app.put("/2/lists/:id", (c) =>
    socialWrite(c, store, (body) =>
      c.json(
        { data: { id: c.req.param("id"), name: stringBody(body, "name") } },
        200
      )
    )
  );

  app.delete("/2/lists/:id", (c) =>
    socialWrite(c, store, () => c.json({ data: { deleted: true } }, 200))
  );

  app.post("/2/lists/:id/members", (c) =>
    socialWrite(c, store, () => c.json({ data: { member: true } }, 200))
  );

  app.delete("/2/lists/:id/members/:user_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { member: false } }, 200))
  );

  app.post("/2/users/:source_user_id/followed_lists", (c) =>
    socialWrite(c, store, () => c.json({ data: { following: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/followed_lists/:list_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { following: false } }, 200))
  );

  app.post("/2/users/:source_user_id/pinned_lists", (c) =>
    socialWrite(c, store, () => c.json({ data: { pinned: true } }, 200))
  );

  app.delete("/2/users/:source_user_id/pinned_lists/:list_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { pinned: false } }, 200))
  );

  app.post("/2/dm_conversations", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { dm_conversation_id: "dm_conversation_1" } }, 200)
    )
  );

  app.post("/2/dm_conversations/with/:participant_id/messages", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { dm_event_id: "dm_event_1" } }, 200)
    )
  );

  app.post("/2/dm_conversations/:dm_conversation_id/messages", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { dm_event_id: "dm_event_1" } }, 200)
    )
  );

  app.delete("/2/dm_events/:event_id", (c) =>
    socialWrite(c, store, () => c.json({ data: { deleted: true } }, 200))
  );

  app.post("/2/chat/conversations/group", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { id: "chat_conversation_1" } }, 200)
    )
  );

  app.post("/2/chat/conversations/group/initialize", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { id: "chat_conversation_1", initialized: true } }, 200)
    )
  );

  app.post("/2/chat/conversations/:id/keys", (c) =>
    socialWrite(c, store, () => c.json({ data: { keys: true } }, 200))
  );

  app.post("/2/chat/conversations/:id/members", (c) =>
    socialWrite(c, store, () => c.json({ data: { members: true } }, 200))
  );

  app.post("/2/chat/conversations/:id/messages", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { message_id: "chat_message_1" } }, 200)
    )
  );

  app.post("/2/chat/conversations/:id/read", (c) =>
    socialWrite(c, store, () => c.json({ data: { read: true } }, 200))
  );

  app.post("/2/chat/conversations/:id/typing", (c) =>
    socialWrite(c, store, () => c.json({ data: { typing: true } }, 200))
  );

  app.post("/2/users/:source_user_id/public_keys", (c) =>
    socialWrite(c, store, () => c.json({ data: { public_key: true } }, 200))
  );

  app.post("/2/media/metadata", (c) =>
    socialWrite(c, store, () =>
      c.json({ data: { media_metadata_id: "media_metadata_1" } }, 200)
    )
  );

  app.post("/2/media/subtitles", (c) =>
    socialWrite(c, store, () => c.json({ data: { subtitles: true } }, 200))
  );

  app.delete("/2/media/subtitles", (c) =>
    socialWrite(c, store, () => c.json({ data: { deleted: true } }, 200))
  );

  app.post("/2/notes", (c) =>
    socialWrite(c, store, () => c.json({ data: { id: "note_1" } }, 200))
  );

  app.delete("/2/notes/:id", (c) =>
    socialWrite(c, store, () => c.json({ data: { deleted: true } }, 200))
  );

  app.post("/2/evaluate_note", (c) =>
    socialWrite(c, store, () => c.json({ data: { evaluated: true } }, 200))
  );
}
