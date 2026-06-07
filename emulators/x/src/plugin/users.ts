import type { AppEnv, Entity, Hono, Store } from "@emulators/core";

import { X_EMULATOR_FIXTURES } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";

export interface XUserRow extends Entity {
  description?: string;
  location?: string;
  name: string;
  url?: string;
  username: string;
  x_id: string;
}

function userResponse(store: Store) {
  const user = store.collection<XUserRow>("users").all()[0];
  if (user) {
    return { data: userJson(user) };
  }
  return {
    data: {
      id: X_EMULATOR_FIXTURES.userId,
      name: X_EMULATOR_FIXTURES.userName,
      username: X_EMULATOR_FIXTURES.username,
    },
  };
}

function findUserById(store: Store, id: string) {
  return store
    .collection<XUserRow>("users")
    .all()
    .find((user) => user.x_id === id);
}

function findUserByUsername(store: Store, username: string) {
  return store
    .collection<XUserRow>("users")
    .all()
    .find((user) => user.username === username);
}

function userJson(user: XUserRow) {
  return {
    description: user.description,
    id: user.x_id,
    location: user.location,
    name: user.name,
    url: user.url,
    username: user.username,
  };
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function registerUsers(app: Hono<AppEnv>, store: Store): void {
  app.get("/2/users/me", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersMe) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    return c.json(userResponse(store), 200);
  });

  app.get("/2/users/by/username/:username", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const user = findUserByUsername(store, c.req.param("username"));
    if (!user) {
      return c.json({ title: "Not Found", status: 404 }, 404);
    }
    return c.json({ data: userJson(user) }, 200);
  });

  app.get("/2/users/by", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const usernames = splitCsv(c.req.query("usernames"));
    const users = usernames
      .map((username) => findUserByUsername(store, username))
      .filter((user): user is XUserRow => !!user)
      .map(userJson);
    return c.json({ data: users }, 200);
  });

  app.get("/2/users/:id", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const user = findUserById(store, c.req.param("id"));
    if (!user) {
      return c.json({ title: "Not Found", status: 404 }, 404);
    }
    return c.json({ data: userJson(user) }, 200);
  });

  app.get("/2/users", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersLookup) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    const ids = splitCsv(c.req.query("ids"));
    const users = ids
      .map((id) => findUserById(store, id))
      .filter((user): user is XUserRow => !!user)
      .map(userJson);
    return c.json({ data: users }, 200);
  });
}
