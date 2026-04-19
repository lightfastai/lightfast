export interface SkillManifest {
  description: string;
  hasCommand: boolean;
  name: string;
  path: string;
}

export interface DotLightfastConfig {
  skills: SkillManifest[];
  spec: string | null;
}

export type FetcherResult =
  | { type: "file"; content: string }
  | { type: "dir"; entries: { name: string; type: "file" | "dir" }[] }
  | { type: "missing" };

export type Fetcher = (path: string) => Promise<FetcherResult>;

export class DotLightfastParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DotLightfastParseError";
  }
}
