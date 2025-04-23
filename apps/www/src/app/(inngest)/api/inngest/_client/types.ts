/* eslint-disable @typescript-eslint/consistent-type-definitions */
// Initial context for repository identification
export interface EarlyAccessUserCreatedData {
  email: string;
}

export type Events = {
  "early-access/user.created": {
    data: EarlyAccessUserCreatedData;
  };
};
