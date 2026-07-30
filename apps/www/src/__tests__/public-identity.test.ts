import { describe, expect, it } from "vitest";
import { getLlmsFooter } from "../lib/site/discovery";
import {
  buildOrganizationEntity,
  SITE_IDENTITY,
} from "../lib/site/identity";

describe("public founder identity", () => {
  it("uses the canonical personal Person reference", () => {
    expect(SITE_IDENTITY.contact.founder).toEqual({
      name: "Jeevan Pillay",
      email: "jp@lightfast.ai",
      id: "https://www.jeevanpillay.com/#person",
      url: "https://www.jeevanpillay.com/",
    });

    expect(buildOrganizationEntity().founder).toEqual({
      "@type": "Person",
      "@id": "https://www.jeevanpillay.com/#person",
      name: "Jeevan Pillay",
      url: "https://www.jeevanpillay.com/",
    });
  });

  it("uses the official personal domain in discovery output", () => {
    expect(getLlmsFooter()).toContain(
      "- Founder: Jeevan Pillay - jp@lightfast.ai - https://www.jeevanpillay.com/"
    );
  });
});
