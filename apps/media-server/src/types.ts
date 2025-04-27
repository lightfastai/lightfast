export interface ResourceVariant {
  id: string;
  width: number;
  height: number;
  url: string;
}

export interface Resource {
  id: string;
  mimeType: string;
  createdAt: Date;
  dimensions?: { width: number; height: number };
  storageURL: string;
  variants: ResourceVariant[];
  processingProfile: string;
}
