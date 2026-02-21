interface StructuredDataProps {
  type?: 'WebApplication' | 'Organization' | 'WebSite' | 'SoftwareApplication';
  additionalData?: Record<string, unknown>;
}

const EMPTY_ADDITIONAL_DATA: Record<string, unknown> = {};

export function StructuredData({ type = 'WebApplication', additionalData = EMPTY_ADDITIONAL_DATA }: StructuredDataProps) {
  const baseUrl = "https://chat.lightfast.ai";
  
  const getStructuredData = () => {
    switch (type) {
      case 'WebApplication':
        return {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Lightfast Chat",
          "url": baseUrl,
          "description": "Open-source, model agnostic AI chat interface. Connect to any AI model (GPT, Claude, Gemini, Llama) through one unified interface.",
          "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Web Browser",
          "browserRequirements": "Requires JavaScript. Requires HTML5.",
          "softwareVersion": "1.0",
          "license": "https://github.com/lightfastai/lightfast/blob/main/LICENSE",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock"
          },
          "creator": {
            "@type": "Organization",
            "@id": "https://lightfast.ai#organization"
          },
          "publisher": {
            "@type": "Organization",
            "@id": "https://lightfast.ai#organization"
          },
          "applicationSubCategory": "Open Source AI Chat Interface",
          "featureList": [
            "Model agnostic AI chat",
            "Support for GPT, Claude, Gemini, Llama",
            "Open source and self-hostable",
            "Unified interface for multiple AI models",
            "Real-time conversation",
            "Developer-friendly APIs",
            "Free to use and modify"
          ],
          "screenshot": `${baseUrl}/og-image.jpg`,
          "codeRepository": "https://github.com/lightfastai/lightfast",
          ...additionalData
        };

      case 'Organization':
        return {
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://lightfast.ai#organization",
          "name": "Lightfast",
          "url": "https://lightfast.ai",
          "logo": `${"https://lightfast.ai"}/logo.png`,
          "description": "Open-source AI company building model agnostic chat interfaces and developer tools for the AI ecosystem",
          "sameAs": [
            "https://x.com/lightfastai",
            "https://github.com/lightfastai",
            "https://discord.gg/YqPDfcar2C"
          ],
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Melbourne",
            "addressRegion": "VIC", 
            "postalCode": "3141",
            "addressCountry": "AU"
          },
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Service",
            "url": "https://discord.gg/YqPDfcar2C"
          },
          "foundingDate": "2024",
          "industry": "Open Source Software",
          "keywords": "open source, AI chat, model agnostic, developer tools",
          "makesOffer": {
            "@type": "Offer",
            "itemOffered": {
              "@type": "SoftwareApplication",
              "name": "Lightfast Chat"
            },
            "price": "0",
            "priceCurrency": "USD"
          },
          ...additionalData
        };

      case 'WebSite':
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Lightfast Chat",
          "url": baseUrl,
          "description": "Advanced AI chat interface powered by Lightfast",
          "publisher": {
            "@type": "Organization",
            "@id": "https://lightfast.ai#organization"
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${baseUrl}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
          },
          "inLanguage": "en-US",
          ...additionalData
        };

      case 'SoftwareApplication':
        return {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Lightfast Chat",
          "url": baseUrl,
          "description": "Open-source, model agnostic AI chat interface that works with any AI model",
          "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Web Browser",
          "softwareVersion": "1.0",
          "datePublished": "2024-01-01",
          "license": "https://github.com/lightfastai/lightfast/blob/main/LICENSE",
          "codeRepository": "https://github.com/lightfastai/lightfast",
          "creator": {
            "@type": "Organization", 
            "@id": "https://lightfast.ai#organization"
          },
          "offers": {
            "@type": "Offer",
            "name": "Free and Open Source",
            "price": "0",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock"
          },
          "featureList": [
            "Open source",
            "Model agnostic",
            "Support for GPT, Claude, Gemini, Llama",
            "Self-hostable",
            "Unified interface",
            "Real-time chat"
          ],
          "programmingLanguage": ["TypeScript", "JavaScript", "React"],
          "runtimePlatform": "Web Browser",
          "downloadUrl": baseUrl,
          "installUrl": baseUrl,
          ...additionalData
        };

      default:
        return {};
    }
  };

  const structuredData = getStructuredData();

  return (
    <script
      id={`structured-data-${type}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
}