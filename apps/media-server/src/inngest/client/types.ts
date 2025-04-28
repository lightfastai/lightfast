/* eslint-disable @typescript-eslint/consistent-type-definitions */
// Initial context for repository identification
export interface ExampleData {
  requestId: string;
}

export type Events = {
  "media-server/example": {
    data: ExampleData;
  };
};
