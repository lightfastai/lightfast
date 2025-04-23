/* eslint-disable @typescript-eslint/consistent-type-definitions */
// Initial context for repository identification
export interface EarlyAccessJoinData {
  email: string;
  requestId: string;
}

export type Events = {
  "early-access/join": {
    data: EarlyAccessJoinData;
  };
};
