// Enhanced citation parser supporting both legacy text format and new JSON format

export interface CitationSource {
  id: number;
  url: string;
  title?: string;  // Optional, will be auto-generated if not provided
  snippet?: string; // Optional description
}

export interface CitationData {
  sources: CitationSource[];
}

/**
 * Parse text for citations - supports both new JSON format and legacy text format
 * 
 * New JSON format (preferred):
 * ---CITATIONS---
 * {
 *   "citations": [
 *     {"id": 1, "url": "https://example.com", "title": "Title", "snippet": "Description"}
 *   ]
 * }
 * 
 * Legacy format (backward compatibility):
 * Some text with citations [1] and more text [2].
 * Cited sources: [1] https://example.com/page1 [2] https://example.com/page2
 */
export function parseCitations(text: string): CitationData {
  if (!text) return { sources: [] };

  // First, try to parse new JSON format
  const jsonCitations = parseJsonCitations(text);
  if (jsonCitations.sources.length > 0) {
    return jsonCitations;
  }
  
  // Fall back to legacy text parsing
  return parseLegacyCitations(text);
}

/**
 * Parse new JSON citation format
 */
function parseJsonCitations(text: string): CitationData {
  try {
    // Look for citation delimiter
    const citationDelimiter = '---CITATIONS---';
    const delimiterIndex = text.indexOf(citationDelimiter);
    
    if (delimiterIndex === -1) {
      return { sources: [] };
    }
    
    // Extract JSON block after delimiter
    const jsonBlock = text.substring(delimiterIndex + citationDelimiter.length).trim();
    const parsed = JSON.parse(jsonBlock) as { citations: CitationSource[] };
    
    if (parsed?.citations && Array.isArray(parsed.citations)) {
      // Validate and enhance citations
      const sources = parsed.citations.map(citation => ({
        id: citation.id,
        url: citation.url,
        title: citation.title || generateSourceTitle(citation.url),
        snippet: citation.snippet
      }));
      
      return { sources };
    }
  } catch (e) {
    // JSON parsing failed, will fall back to legacy parsing
  }
  
  return { sources: [] };
}

/**
 * Parse legacy text citation format for backward compatibility
 */
function parseLegacyCitations(text: string): CitationData {
  const sources: CitationSource[] = [];
  
  // Find citation list at the end (lines starting with [number] url)
  const citationListRegex = /\[(\d+)\]\s+(https?:\/\/[^\s]+)/gm;
  const citationMatches = [...text.matchAll(citationListRegex)];
  
  // Extract URLs in order and create CitationSource objects
  for (const match of citationMatches) {
    const [, idStr, url] = match;
    if (url && idStr) {
      sources.push({
        id: parseInt(idStr, 10),
        url,
        title: generateSourceTitle(url)
      });
    }
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
        
        // Skip undefined segments and common non-meaningful segments
        if (!segment || isNonMeaningfulSegment(segment)) {
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
        title = domainParts[domainParts.length - 2] || ''; // Get the main domain name
      } else {
        title = domainParts[0] || '';
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