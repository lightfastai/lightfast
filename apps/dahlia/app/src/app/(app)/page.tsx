// Start of Selection
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
    <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center pb-32">
      <div className="flex h-[40vh] w-full flex-col items-center justify-center gap-12">
        <h1 className="text-2xl font-bold">What can I help you create?</h1>
        <form className="relative w-full max-w-xl">
          <Input
            // value={input}
            placeholder="Generate a cool texture..."
            // onChange={(e) => setInput(e.target.value)}
            // disabled={isLoading}
            className="pr-12 transition-all duration-200 ease-in-out"
          />
          <div className="absolute right-0 top-0">
            <Button type="submit" variant="outline" size="icon" disabled={true}>
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        <span className="text-balance text-left text-2xl leading-6 text-primary">
          Or start with a template
        </span>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent>
            <CarouselItem>
              <Card className="h-[600px] w-full overflow-hidden rounded-[0.25rem]">
                <Image
                  src="/playground-placeholder-1.webp"
                  alt="playground-placeholder-1"
                  width={1000}
                  height={1000}
                  className="h-full w-full object-cover"
                />
              </Card>
            </CarouselItem>
            <CarouselItem>
              <Card className="h-[600px] w-full overflow-hidden rounded-[0.25rem]">
                <Image
                  src="/playground-placeholder-2.webp"
                  alt="playground-placeholder-2"
                  width={1000}
                  height={1000}
                  className="h-full w-full object-cover"
                />
              </Card>
            </CarouselItem>
            <CarouselItem>
              <Card className="h-[600px] w-full overflow-hidden rounded-[0.25rem]">
                <Image
                  src="/playground-placeholder-3.webp"
                  alt="playground-placeholder-3"
                  width={1000}
                  height={1000}
                  className="h-full w-full object-cover"
                />
              </Card>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </div>
  );
}
