import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wwwRoot = resolve(import.meta.dirname, "../..");
const marketingRoot = resolve(wwwRoot, "src/app/(site)/(marketing)");
const componentsRoot = resolve(marketingRoot, "_components");

function readMarketingSource(path: string) {
  return readFileSync(resolve(marketingRoot, path), "utf8");
}

function readComponentSource(path: string) {
  return readFileSync(resolve(componentsRoot, path), "utf8");
}

describe("marketing company naming", () => {
  it("uses Company as the marketing sheet convention", () => {
    expect(existsSync(resolve(componentsRoot, "company.tsx"))).toBe(true);
    expect(existsSync(resolve(componentsRoot, "company-sheet.tsx"))).toBe(true);
    expect(existsSync(resolve(componentsRoot, "about.tsx"))).toBe(false);
    expect(existsSync(resolve(componentsRoot, "about-sheet.tsx"))).toBe(false);

    const companySource = readComponentSource("company.tsx");
    const companySheetSource = readComponentSource("company-sheet.tsx");
    const sidebarSource = readComponentSource("sidebar.tsx");
    const layoutSource = readMarketingSource("layout.tsx");

    expect(companySource).toContain("export function Company");
    expect(companySource).toContain('"Company"');
    expect(companySource).toContain('import("./company-sheet")');
    expect(companySource).toContain("mod.CompanySheet");
    expect(companySource).toContain("data-company-trigger");

    expect(companySheetSource).toContain("export function CompanySheet");
    expect(companySheetSource).toContain("group/company-sheet");
    expect(companySheetSource).toContain("Company");

    expect(sidebarSource).toContain('import { Company } from "./company"');
    expect(sidebarSource).toContain("<Company");
    expect(sidebarSource).toMatch(/>\s*Company\s*</);

    expect(layoutSource).toContain("group/company");
    expect(layoutSource).toContain("data-company-trigger");

    for (const [path, source] of [
      ["company.tsx", companySource],
      ["company-sheet.tsx", companySheetSource],
      ["sidebar.tsx", sidebarSource],
      ["layout.tsx", layoutSource],
    ] as const) {
      expect(source, path).not.toContain("About");
      expect(source, path).not.toContain("data-about-trigger");
      expect(source, path).not.toContain("group/about");
    }
  });
});
