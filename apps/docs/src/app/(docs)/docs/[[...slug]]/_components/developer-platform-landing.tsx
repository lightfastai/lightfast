import { CodeEditor } from "@/src/components/code-editor";
import { exposureTrial } from "@/src/lib/fonts";

const lightfastConfig = `# Lightfast Configuration
# Docs: https://lightfast.com/docs/get-started/config

version: 1

# Store name (unique identifier for this documentation set)
store: root-store

# Files to include (glob patterns)
include:
  - "README.md"

# Files to exclude (optional)
exclude:
  - "**/node_modules/**"
  - "**/.git/**"`;

export function DeveloperPlatformLanding() {
  return (
    <div className="mx-auto">
      {/* Hero Section - centered content */}
      <div className="max-w-7xl mx-auto grid grid-cols-12 section-gap-b">
        <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
          <section className="flex w-full flex-col items-center text-center">
            {/* Heading */}
            <h1
              className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
            >
              Memory built for teams
            </h1>

            {/* Description */}
            <div className="mt-4 px-4 w-full">
              <p className="text-base text-muted-foreground">
                Search everything your team knows. Get answers with sources.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Configuration Section - Grid Layout */}
      <div className="section-gap-b">
        <div className="grid grid-cols-1 bg-card border border-transparent rounded-xs p-6 lg:grid-cols-12 gap-16">
          {/* Left Column: Description (5/12) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                Configuration
              </p>
              <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl max-w-sm text-foreground">
                Configure your memory store
              </h3>
            </div>
            <div className="flex-1 flex items-center">
              <div className="space-y-6 -mt-8">
                <p className="text-sm text-muted-foreground max-w-sm">
                  Define what gets indexed and remembered. Use glob patterns to
                  include documentation, code, and context your team needs.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Code Editor (7/12) */}
          <div className="lg:col-span-7 h-full">
            <CodeEditor
              code={lightfastConfig}
              language="yaml"
              className="border-border"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
