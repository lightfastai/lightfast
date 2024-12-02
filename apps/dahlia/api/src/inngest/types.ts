import { UserJSON } from "@repo/auth/server";

export type UserCreatedEventData = UserJSON;

export type Events = {
  "user/created": {
    data: UserCreatedEventData;
  };
};
