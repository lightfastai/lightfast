import Image from "next/image";

interface Integration {
  name: string;
  image: string;
}

// Available creative app logos
const creativeAppLogos = [
  "/creative-app-logos/blender.png",
  "/creative-app-logos/houdini.png",
  "/creative-app-logos/touchdesigner.png",
  "/creative-app-logos/unreal-engine.png",
];

// List of integrations (names only, images will be assigned randomly)
const integrationNames = [
  "Blender",
  "Maya",
  "Cinema 4D",
  "3ds Max",
  "Houdini",
  "ZBrush",
  "Substance Painter",
  "Mudbox",
  "Unity",
  "Unreal Engine",
  "Godot",
  "GameMaker Studio",
  "Construct 3",
  "CryEngine",
  "RPG Maker",
  "Defold",
  "Fusion 360",
  "SolidWorks",
  "AutoCAD",
  "Rhino",
  "After Effects",
];

// Assign a logo to each integration (modulo ensures always a string)
const integrations: Integration[] = integrationNames.map((name, i) => ({
  name,
  image: creativeAppLogos[i % creativeAppLogos.length]!,
}));

export function IntegrationsSection() {
  return (
    <section className="bg-background py-16">
      <div>
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">
            Works with your
            <span className="text-primary ml-2 italic">favorite tools</span>
          </h2>
        </div>

        {/* Applications Grid - 3 rows, 8 per row */}
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-7">
          {integrations.map((integration, index) => (
            <div
              key={`${integration.name}-${index}`}
              className="group flex items-center justify-center"
            >
              <div className="border-border hover:border-primary/50 bg-background relative flex aspect-square w-full items-center justify-center border transition-all duration-300">
                <div className="relative h-12 w-12 sm:h-16 sm:w-16 md:h-24 md:w-24">
                  <Image
                    src={integration.image}
                    alt={integration.name + " logo"}
                    fill
                    style={{ objectFit: "contain" }}
                    className="grayscale transition-all duration-300 group-hover:grayscale-0"
                    sizes="(max-width: 768px) 64px, (max-width: 1200px) 96px, 128px"
                    priority={index < 8}
                    quality={70}
                  />
                </div>
                <div className="absolute bottom-3 left-3 font-mono text-xs text-white">
                  {integration.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
