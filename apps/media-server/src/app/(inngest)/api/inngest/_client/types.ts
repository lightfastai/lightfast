/* eslint-disable @typescript-eslint/consistent-type-definitions */

import { FalGenerateImageSuccessPayload } from "@repo/ai";

// Initial context for repository identification
export interface ExampleData {
  requestId: string;
}

export type HandleCreateImageData = {
  id: string;
  prompt: string;
};

export type ResourceImageSuccessData = {
  id: string;
  data: Pick<FalGenerateImageSuccessPayload, "payload">;
};

export type HandleCreateVideoData = {
  id: string;
  prompt: string;
};

export type ResourceVideoSuccessData = {
  id: string;
  url: string;
};

export type Events = {
  "media-server/example": {
    data: ExampleData;
  };
  "media-server/handle-create-image": {
    data: HandleCreateImageData;
  };
  "media-server/resource-image-success": {
    data: ResourceImageSuccessData;
  };
  "media-server/handle-create-video": {
    data: HandleCreateVideoData;
  };
  "media-server/resource-video-success": {
    data: ResourceVideoSuccessData;
  };
};
