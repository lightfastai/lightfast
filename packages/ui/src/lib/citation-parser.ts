// Simple citation parser for numbered citations [1], [2], [3]

export interface CitationData {
  sources: string[];
}

/**
 * Parse text for numbered citations and extract the URLs from the citation list
 * Expected format:
 * 
 * Some text with citations [1] and more text [2].
 * 
 * Cited sources (for easy reference): [1] https://example.com/page1 [2] https://example.com/page2
 */
export function parseCitations(text: string): CitationData {
  if (!text) return { sources: [] };

  const sources: string[] = [];
  
  // Find citation list at the end (lines starting with [number] url)
  const citationListRegex = /\[(\d+)\]\s+(https?:\/\/[^\s]+)/gm;
  const citationMatches = [...text.matchAll(citationListRegex)];
  
  // Extract URLs in order
  for (const match of citationMatches) {
    const [, , url] = match;
    sources.push(url);
  }
  
  return { sources };
}

/**
 * Check if text contains any numbered citations
 */
export function hasCitations(text: string): boolean {
  const citationRegex = /\[(\d+)\]/;
  return citationRegex.test(text);
}

/**
 * Generate a meaningful title from URL - universal approach
 */
export function generateSourceTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname;
    
    // Get all path segments, filtering out empty ones
    const pathParts = path.split('/').filter(part => part && part !== 'index');
    
    // Look for the most meaningful path segment (usually the last non-empty one)
    let title = '';
    
    if (pathParts.length > 0) {
      // Start with the last segment and work backwards to find something meaningful
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const segment = pathParts[i];
        
        // Skip common non-meaningful segments
        if (isNonMeaningfulSegment(segment)) {
          continue;
        }
        
        // Clean up the segment
        const cleaned = cleanUrlSegment(segment);
        
        // If we got something meaningful, use it
        if (cleaned.length > 2) {
          title = cleaned;
          break;
        }
      }
    }
    
    // If we couldn't extract a meaningful title from path, use domain
    if (!title) {
      // Extract main domain name (remove common TLDs and subdomains)
      const domainParts = domain.split('.');
      if (domainParts.length >= 2) {
        title = domainParts[domainParts.length - 2]; // Get the main domain name
      } else {
        title = domainParts[0];
      }
    }
    
    return titleCase(title);
    
  } catch (e) {
    return 'External Source';
  }
}

/**
 * Check if a URL segment is not meaningful for title generation
 */
function isNonMeaningfulSegment(segment: string): boolean {
  const nonMeaningful = [
    // File extensions that don't add meaning
    /\.(html|htm|php|asp|aspx|jsp)$/i,
    // Generic segments
    /^(index|default|home|page|main)$/i,
    // Very short segments
    /^.{1,2}$/,
    // Pure numbers (usually IDs)
    /^\d+$/,
    // Common generic paths
    /^(src|assets|public|static|img|images|js|css)$/i,
  ];
  
  return nonMeaningful.some(pattern => pattern.test(segment));
}

/**
 * Clean a URL segment to make it human-readable
 */
function cleanUrlSegment(segment: string): string {
  return segment
    // Remove file extensions
    .replace(/\.(html|htm|php|asp|aspx|jsp|pdf|doc|docx)$/i, '')
    // Convert dashes and underscores to spaces
    .replace(/[-_]/g, ' ')
    // Remove URL encoding
    .replace(/%20/g, ' ')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert string to title case
 */
function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}