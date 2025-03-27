import type { UserJSON } from "@vendor/clerk/server";

export type UserCreatedEventData = UserJSON;

export type Events = {
  "user/created": {
    data: UserCreatedEventData;
  };
};
