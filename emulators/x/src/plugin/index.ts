import type { ServicePlugin } from "@emulators/core";

import { X_EMULATOR_POSTS, X_EMULATOR_USERS } from "../fixtures";
import { registerFailures, seedFailures } from "./failures";
import { registerOAuth } from "./oauth";
import { registerPosts, type XPostRow } from "./posts";
import { registerUsers, type XUserRow } from "./users";

export const xPlugin: ServicePlugin = {
  name: "x",
  register(app, store) {
    registerOAuth(app, store);
    registerUsers(app, store);
    registerPosts(app, store);
    registerFailures(app, store);
  },
  seed(store) {
    seedFailures(store);
    for (const user of X_EMULATOR_USERS) {
      store.collection<XUserRow>("users").insert({
        name: user.name,
        username: user.username,
        x_id: user.id,
      });
    }
    for (const post of X_EMULATOR_POSTS) {
      store.collection<XPostRow>("posts").insert({
        author_id: post.author_id,
        text: post.text,
        tweet_id: post.id,
      });
    }
  },
};
