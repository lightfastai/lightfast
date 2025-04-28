/* eslint-disable @typescript-eslint/consistent-type-definitions */
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
};
