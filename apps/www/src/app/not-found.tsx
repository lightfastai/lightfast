import Link from "next/link";

import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
  ErrorCode,
  LightfastErrorPage,
} from "@repo/ui/components/lightfast-error-page";
import { Button } from "@repo/ui/components/ui/button";

export default function NotFound() {
  return (
    <LightfastCustomGridBackground.Root
      marginVertical="25vh"
      marginHorizontal="25vw"
      marginVerticalMobile="25vh"
      marginHorizontalMobile="10vw"
    >
      <LightfastCustomGridBackground.Container>
        <LightfastErrorPage
          code={ErrorCode.NotFound}
          description="Sorry, we couldn't find the page you're looking for."
        >
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </LightfastErrorPage>
      </LightfastCustomGridBackground.Container>
    </LightfastCustomGridBackground.Root>
  );
}
