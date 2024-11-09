import Image from "next/image";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui/components/ui/carousel";
import { Input } from "@repo/ui/components/ui/input";

export default function Page() {
  return (
    <main
      className="relative mx-auto flex min-h-screen w-full flex-col items-center justify-center px-4 pb-20 sm:max-w-4xl sm:px-0 sm:pb-32"
      aria-label="Main content"
    >
      <div className="flex h-[30vh] w-full flex-col items-center justify-center gap-6 sm:h-[30vh] sm:gap-12">
        <h1 className="text-balance px-4 text-center text-xl font-bold sm:text-2xl">
          What can I help you create?
        </h1>
        <form
          className="relative w-full max-w-xl px-4 sm:px-0"
          role="search"
          aria-label="Generate texture"
        >
          <Input
            placeholder="Generate a cool texture..."
            className="pr-12 text-sm transition-all duration-200 ease-in-out sm:text-base"
            aria-label="Texture generation prompt"
          />
          <div className="absolute right-0 top-0">
            <Button
              type="submit"
              variant="outline"
              size="icon"
              disabled={true}
              aria-label="Generate texture"
            >
              <ArrowRightIcon className="h-4 w-4" />
              <span className="sr-only">Submit generation request</span>
            </Button>
          </div>
        </form>
      </div>

      <div className="flex w-full flex-col items-start gap-4 px-4 sm:gap-6 sm:px-0">
        <h2 className="text-balance text-left text-xl leading-6 text-primary sm:text-2xl">
          Or start with a template
        </h2>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
          aria-label="Template gallery"
        >
          <CarouselContent className="-ml-2 sm:-ml-4">
            {[1, 2, 3].map((id) => (
              <CarouselItem
                key={id}
                className="pl-2 sm:pl-4 md:basis-1/2"
                role="group"
                aria-label={`Template ${id}`}
              >
                <Card className="relative h-[400px] w-full overflow-hidden rounded-[0.25rem] transition-transform duration-300 hover:scale-[1.02] sm:h-[300px]">
                  <Image
                    src={`/playground-placeholder-${id}.webp`}
                    alt={`Template preview ${id}`}
                    width={1000}
                    height={1000}
                    className="h-full w-full object-cover"
                  />
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="block">
            <CarouselPrevious
              className="left-4"
              aria-label="View previous template"
            />
            <CarouselNext className="right-4" aria-label="View next template" />
          </div>
        </Carousel>
      </div>
    </main>
  );
}
