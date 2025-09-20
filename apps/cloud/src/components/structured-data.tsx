import { siteConfig } from "@repo/site-config";

interface StructuredDataProps {
  type?: 'SoftwareApplication' | 'Organization' | 'WebSite' | 'Product';
  additionalData?: Record<string, unknown>;
}

export function StructuredData({ type = 'SoftwareApplication', additionalData = {} }: StructuredDataProps) {
  const baseUrl = `${siteConfig.url}/cloud`;
  
  const getStructuredData = () => {
    switch (type) {
      case 'SoftwareApplication':
        return {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "@id": `${baseUrl}#software`,
          "name": "Lightfast Cloud",
          "alternateName": "Lightfast Cloud Platform",
          "url": baseUrl,
          "description": "Enterprise-grade cloud platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical agent workloads.",
          "applicationCategory": "DeveloperApplication",
          "applicationSubCategory": "Enterprise AI Infrastructure Platform",
          "operatingSystem": ["Web Browser", "Cloud", "Linux", "Docker"],
          "softwareVersion": "1.0",
          "datePublished": "2024-01-01",
          "dateModified": new Date().toISOString(),
          "creator": {
            "@type": "Organization",
            "@id": `${siteConfig.url}#organization`
          },
          "publisher": {
            "@type": "Organization", 
            "@id": `${siteConfig.url}#organization`
          },
          "offers": [
            {
              "@type": "Offer",
              "name": "Developer Plan",
              "price": "0",
              "priceCurrency": "USD", 
              "availability": "https://schema.org/InStock",
              "businessFunction": "http://purl.org/goodrelations/v1#Free",
              "description": "Free tier for development and prototyping"
            },
            {
              "@type": "Offer", 
              "name": "Production Plan",
              "businessFunction": "http://purl.org/goodrelations/v1#Sell",
              "availability": "https://schema.org/InStock",
              "description": "Usage-based pricing for production workloads"
            },
            {
              "@type": "Offer",
              "name": "Enterprise Plan",
              "businessFunction": "http://purl.org/goodrelations/v1#Sell", 
              "availability": "https://schema.org/InStock",
              "description": "Custom deployments with dedicated infrastructure and SLAs"
            }
          ],
          "featureList": [
            "Enterprise-grade agent execution engine",
            "Advanced orchestration and workflow management", 
            "Production-ready security and compliance",
            "Auto-scaling and resource optimization",
            "Real-time monitoring and observability",
            "High availability and disaster recovery",
            "API-first architecture",
            "Multi-cloud deployment support",
            "Enterprise SSO and access controls",
            "24/7 enterprise support",
            "Custom SLAs and dedicated infrastructure",
            "Advanced analytics and reporting"
          ],
          "screenshot": `${siteConfig.ogImage}`,
          "downloadUrl": baseUrl,
          "installUrl": baseUrl,
          "softwareRequirements": "Modern web browser, API access",
          "programmingLanguage": ["TypeScript", "JavaScript", "Python", "Go"],
          "runtimePlatform": ["Cloud", "Kubernetes", "Docker"],
          "targetProduct": "Enterprise AI Agent Applications",
          "audience": {
            "@type": "Audience",
            "audienceType": "Enterprise developers and DevOps teams building production AI agents"
          },
          "competitorOf": [
            "AWS Lambda",
            "Google Cloud Run", 
            "Vercel Functions",
            "Railway",
            "Render",
            "Kubernetes"
          ],
          "serviceType": "Platform as a Service (PaaS)",
          "industry": "Enterprise AI Infrastructure",
          "sameAs": [
            siteConfig.links.github.href,
            siteConfig.links.twitter.href
          ],
          ...additionalData
        };

      case 'Organization':
        return {
          "@context": "https://schema.org",
          "@type": ["Organization", "TechnologyCompany"], 
          "@id": `${siteConfig.url}#organization`,
          "name": "Lightfast",
          "legalName": "Lightfast AI",
          "url": siteConfig.url,
          "logo": `${siteConfig.url}/logo.png`,
          "description": "Cloud-native agent execution engine for enterprise AI applications",
          "foundingDate": "2024",
          "industry": ["Enterprise AI Infrastructure", "Developer Tools", "Cloud Platforms"],
          "keywords": "enterprise AI platform, agent deployment, cloud infrastructure, AI orchestration",
          "sameAs": [
            siteConfig.links.twitter.href,
            siteConfig.links.github.href,
            siteConfig.links.discord.href
          ],
          "makesOffer": [
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "SoftwareApplication",
                "@id": `${baseUrl}#software`
              },
              "businessFunction": "http://purl.org/goodrelations/v1#Sell"
            }
          ],
          "knowsAbout": [
            "Enterprise AI Infrastructure",
            "Agent Deployment Platforms", 
            "Cloud Orchestration",
            "Production AI Systems",
            "Enterprise Security",
            "Scalable AI Architecture"
          ],
          ...additionalData
        };

      case 'WebSite':
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Lightfast Cloud - Enterprise Agent Execution Platform",
          "url": baseUrl,
          "description": "Enterprise-grade cloud platform for deploying and scaling AI agents in production",
          "publisher": {
            "@type": "Organization",
            "@id": `${siteConfig.url}#organization`
          },
          "mainEntity": {
            "@type": "SoftwareApplication",
            "@id": `${baseUrl}#software`
          },
          "inLanguage": "en-US", 
          "copyrightYear": "2024",
          "copyrightHolder": {
            "@type": "Organization",
            "@id": `${siteConfig.url}#organization` 
          },
          ...additionalData
        };

      case 'Product':
        return {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Lightfast Cloud Platform",
          "description": "Enterprise-grade cloud platform for deploying and scaling AI agents in production with advanced orchestration, security, and monitoring.",
          "brand": {
            "@type": "Brand", 
            "name": "Lightfast"
          },
          "manufacturer": {
            "@type": "Organization",
            "@id": `${siteConfig.url}#organization`
          },
          "category": "Enterprise AI Infrastructure Platform",
          "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "0",
            "priceCurrency": "USD",
            "offerCount": "3",
            "availability": "https://schema.org/InStock"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8", 
            "ratingCount": "89",
            "bestRating": "5",
            "worstRating": "1"
          },
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