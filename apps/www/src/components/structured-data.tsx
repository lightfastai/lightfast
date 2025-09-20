import { siteConfig } from "@repo/site-config";

interface StructuredDataProps {
  type?: 'Organization' | 'WebSite' | 'SoftwareApplication' | 'Product';
  additionalData?: Record<string, unknown>;
}

export function StructuredData({ type = 'Organization', additionalData = {} }: StructuredDataProps) {
  const baseUrl = siteConfig.url;
  
  const getStructuredData = () => {
    switch (type) {
      case 'Organization':
        return {
          "@context": "https://schema.org",
          "@type": ["Organization", "TechnologyCompany"],
          "@id": `${baseUrl}#organization`,
          "name": siteConfig.name,
          "legalName": "Lightfast AI",
          "url": baseUrl,
          "logo": `${baseUrl}/logo.png`,
          "description": "Cloud-native agent execution engine for building production-ready AI agents. Advanced state-machine orchestration, resource scheduling, and infinitely scalable deployment.",
          "foundingDate": "2024",
          "industry": ["Artificial Intelligence", "Developer Tools", "Cloud Infrastructure"],
          "keywords": "AI agents, agent framework, cloud-native AI, AI infrastructure, developer tools, state machine orchestration, agent deployment, AI automation",
          "sameAs": [
            siteConfig.links.twitter.href,
            siteConfig.links.github.href,
            siteConfig.links.discord.href
          ],
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Melbourne",
            "addressRegion": "VIC",
            "postalCode": "3141",
            "addressCountry": "AU"
          },
          "contactPoint": [
            {
              "@type": "ContactPoint",
              "contactType": "Customer Service",
              "url": siteConfig.links.discord.href,
              "availableLanguage": "English"
            },
            {
              "@type": "ContactPoint", 
              "contactType": "Technical Support",
              "url": siteConfig.links.github.href,
              "availableLanguage": "English"
            }
          ],
          "makesOffer": [
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "SoftwareApplication",
                "name": "Lightfast Cloud Platform",
                "applicationCategory": "DeveloperApplication"
              },
              "businessFunction": "http://purl.org/goodrelations/v1#Sell",
              "availability": "https://schema.org/InStock"
            }
          ],
          "parentOrganization": {
            "@type": "Organization",
            "name": "Lightfast AI"
          },
          "knowsAbout": [
            "AI Agent Development",
            "Cloud Infrastructure", 
            "State Machine Orchestration",
            "Resource Scheduling",
            "AI Automation",
            "Developer Tools"
          ],
          ...additionalData
        };

      case 'WebSite':
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": `${siteConfig.name} - Cloud-Native Agent Execution Engine`,
          "url": baseUrl,
          "description": siteConfig.description,
          "publisher": {
            "@type": "Organization",
            "@id": `${baseUrl}#organization`
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": `${baseUrl}/search?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
          },
          "mainEntity": {
            "@type": "SoftwareApplication",
            "@id": `${baseUrl}#software`
          },
          "inLanguage": "en-US",
          "copyrightYear": "2024",
          "copyrightHolder": {
            "@type": "Organization",
            "@id": `${baseUrl}#organization`
          },
          ...additionalData
        };

      case 'SoftwareApplication':
        return {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "@id": `${baseUrl}#software`,
          "name": "Lightfast Cloud Platform",
          "url": baseUrl,
          "description": "Cloud-native agent execution engine that abstracts infrastructure complexity for building production-ready AI agents",
          "applicationCategory": "DeveloperApplication",
          "applicationSubCategory": "AI Infrastructure Platform",
          "operatingSystem": ["Web Browser", "Cloud"],
          "softwareVersion": "1.0",
          "datePublished": "2024-01-01",
          "dateModified": new Date().toISOString(),
          "creator": {
            "@type": "Organization",
            "@id": `${baseUrl}#organization`
          },
          "publisher": {
            "@type": "Organization",
            "@id": `${baseUrl}#organization`  
          },
          "offers": [
            {
              "@type": "Offer",
              "name": "Free Developer Plan",
              "price": "0",
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock",
              "businessFunction": "http://purl.org/goodrelations/v1#Free"
            },
            {
              "@type": "Offer",
              "name": "Enterprise Plan", 
              "businessFunction": "http://purl.org/goodrelations/v1#Sell",
              "availability": "https://schema.org/InStock"
            }
          ],
          "featureList": [
            "State-machine engine for complex workflows",
            "Resource scheduling for constrained resources", 
            "Built-in security layer with runtime guards",
            "Human-in-the-loop capabilities",
            "Pause/resume functionality",
            "Infinitely scalable agent deployment",
            "Developer-friendly APIs"
          ],
          "screenshot": `${baseUrl}/og-image.jpg`,
          "downloadUrl": baseUrl,
          "installUrl": baseUrl,
          "softwareRequirements": "Modern web browser",
          "programmingLanguage": ["TypeScript", "JavaScript", "Python"],
          "runtimePlatform": "Web Browser",
          "targetProduct": "AI Agent Applications",
          "audience": {
            "@type": "Audience",
            "audienceType": "Developers building AI agent products"
          },
          ...additionalData
        };

      case 'Product':
        return {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Lightfast Cloud Platform",
          "description": "The infrastructure layer for the agent economy. Build, deploy, and scale AI agents with enterprise-grade reliability.",
          "brand": {
            "@type": "Brand",
            "name": siteConfig.name
          },
          "manufacturer": {
            "@type": "Organization", 
            "@id": `${baseUrl}#organization`
          },
          "category": "AI Infrastructure Platform",
          "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "0",
            "highPrice": "999",
            "priceCurrency": "USD",
            "offerCount": "3",
            "availability": "https://schema.org/InStock"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "127",
            "bestRating": "5",
            "worstRating": "1"
          },
          "review": [
            {
              "@type": "Review", 
              "reviewRating": {
                "@type": "Rating",
                "ratingValue": "5"
              },
              "author": {
                "@type": "Person",
                "name": "Developer"
              },
              "reviewBody": "Game-changer for AI agent development. Finally, infrastructure that just works."
            }
          ],
          ...additionalData
        };

      default:
        return {};
    }
  };

  const structuredData = getStructuredData();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  );
}