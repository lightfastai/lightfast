"use client";

import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { Icons } from "@repo/ui/components/icons";

// export const metadata: Metadata = {
//   title: "Architecture",
//   description: "Lightfast's intelligent architecture for creative workflows",
// };

// Wireframe architecture object
function ArchitectureModel() {
  return (
    <group>
      <mesh rotation={[0, 0, 0]}>
        <dodecahedronGeometry args={[2, 1]} />
        <meshBasicMaterial wireframe color="#0ea5e9" />
      </mesh>
    </group>
  );
}

// To use actual STL files, uncomment and modify this:
/*
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

function STLWireframe({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
      <meshBasicMaterial wireframe color="#0ea5e9" />
    </mesh>
  );
}
*/

// Loading fallback
function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial wireframe color="#666" />
    </mesh>
  );
}

export default function Architecture() {
  return (
    <div className="relative h-screen overflow-hidden">
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="bg-card border-border relative flex h-[600px] w-[800px] flex-col justify-between overflow-hidden border shadow-2xl">
          {/* Header Content */}
          <div className="bg-card/90 relative z-10 p-8 backdrop-blur-sm">
            <h1 className="mb-4 text-4xl font-bold">Architecture</h1>
            <p className="max-w-[600px] text-lg leading-relaxed">
              Discover how Lightfast's modular architecture enables seamless
              integration with your favorite creative applications.
            </p>
          </div>

          {/* 3D Scene */}
          <div className="relative flex-1">
            <Canvas
              camera={{ position: [5, 5, 5], fov: 45 }}
              className="h-full w-full"
            >
              <ambientLight intensity={0.4} />
              <pointLight position={[10, 10, 10]} intensity={0.8} />
              <pointLight position={[-10, -10, -5]} intensity={0.3} />

              <Suspense fallback={<Loader />}>
                <ArchitectureModel />
              </Suspense>

              <OrbitControls
                enableZoom={true}
                enablePan={false}
                autoRotate
                autoRotateSpeed={1.5}
                maxDistance={10}
                minDistance={3}
              />
            </Canvas>
          </div>

          {/* Footer Logo */}
          <div className="bg-card/90 relative z-10 p-8 backdrop-blur-sm">
            <Icons.logoShort className="text-primary h-12 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
