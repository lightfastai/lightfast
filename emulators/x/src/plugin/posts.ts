import type { AppEnv, Entity, Hono, Store } from "@emulators/core";

import { isValidBearer } from "./auth";
import { getFailures } from "./failures";

export interface XPostRow extends Entity {
  author_id: string;
  text: string;
  tweet_id: string;
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function postJson(post: XPostRow) {
  return {
    author_id: post.author_id,
    id: post.tweet_id,
    text: post.text,
  };
}

function allPosts(store: Store) {
  return store.collection<XPostRow>("posts").all();
}

function findPostById(store: Store, id: string) {
  return allPosts(store).find((post) => post.tweet_id === id);
}

export function registerPosts(app: Hono<AppEnv>, store: Store): void {
  app.get("/2/tweets/:id", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).postsLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const post = findPostById(store, c.req.param("id"));
    if (!post) {
      return c.json({ title: "Not Found", status: 404 }, 404);
    }
    return c.json({ data: postJson(post) }, 200);
  });

  app.get("/2/tweets", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).postsLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const ids = splitCsv(c.req.query("ids"));
    const posts = ids
      .map((id) => findPostById(store, id))
      .filter((post): post is XPostRow => !!post)
      .map(postJson);
    return c.json({ data: posts }, 200);
  });

  app.get("/2/tweets/search/recent", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).postsLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const query = (c.req.query("query") ?? "").toLowerCase();
    const posts = allPosts(store)
      .filter((post) => post.text.toLowerCase().includes(query))
      .map(postJson);
    return c.json({ data: posts }, 200);
  });

  app.get("/2/tweets/counts/recent", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).postsLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const query = (c.req.query("query") ?? "").toLowerCase();
    const count = allPosts(store).filter((post) =>
      post.text.toLowerCase().includes(query)
    ).length;
    return c.json({ data: [{ tweet_count: count }] }, 200);
  });
}
