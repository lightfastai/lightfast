import { textToBinary, generateBinaryInstances } from "~/lib/binary";

export default function HomePage() {
  // Convert "god" to binary
  const godBinary = textToBinary("god");
  
  // Generate binary instances with default dimensions
  const instances = generateBinaryInstances(godBinary, 100, 1920, 1080);
  
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {instances.map((instance) => (
        <div
          key={instance.id}
          className="absolute font-mono text-xs text-white select-none whitespace-nowrap"
          style={{
            left: `${instance.x}px`,
            top: `${instance.y}px`
          }}
        >
          {instance.text}
        </div>
      ))}
      <div className="absolute bottom-4 right-4 font-mono text-xs text-zinc-600">
        built by the darkarmy
      </div>
    </main>
  );
}