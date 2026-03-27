export interface SortedResult {
  content: string;
  id: string;
  score?: number;
  snippet?: string;
  source: string;
  type: "page" | "heading" | "text";
  url: string;
}
