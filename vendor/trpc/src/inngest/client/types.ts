/* eslint-disable @typescript-eslint/consistent-type-definitions */

// Initial context for repository identification
export interface ExampleData {
  requestId: string;
}

export type Events = {
  "blender-agent/run": {
    data: { input: string };
  };
};
