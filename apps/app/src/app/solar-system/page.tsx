import Link from "next/link";
import { SolarSystem } from "@/components/solar-system";

import { Button } from "@repo/ui/button";

export default function SolarSystemPage() {
  return (
    <div className="flex h-screen w-full flex-col">
      <div className="flex items-center justify-between bg-black p-4">
        <h1 className="text-2xl font-bold text-white">
          Solar System Simulation
        </h1>
        <Link href="/">
          <Button variant="outline" className="border-white text-white">
            Back to Home
          </Button>
        </Link>
      </div>
      <div className="w-full flex-1">
        <SolarSystem />
      </div>
    </div>
  );
}
