import type { UserJSON } from "@vendor/clerk/server";

export type UserCreatedEventData = UserJSON;

export interface Events {
  "user/created": {
    data: UserCreatedEventData;
  };
}
