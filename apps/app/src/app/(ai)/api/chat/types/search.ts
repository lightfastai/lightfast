/**
 * Search result item interface
 */
export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
}

/**
 * Search result image interface
 */
export interface SearchResultImage {
  url: string;
  description?: string;
}

/**
 * Search results interface
 */
export interface SearchResults {
  results: SearchResultItem[];
  query: string;
  images: (string | SearchResultImage)[];
  number_of_results: number;
}

/**
 * SearXNG Response interface
 */
export interface SearXNGResponse {
  query: string;
  number_of_results: number;
  results: SearXNGResult[];
}

/**
 * SearXNG Result interface
 */
export interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  img_src?: string;
  publishedDate?: string;
  score?: number;
}
