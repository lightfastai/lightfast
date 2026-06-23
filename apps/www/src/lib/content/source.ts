import {
  blogCollection,
  brandCollection,
  homeCollection,
  legalCollection,
} from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";

// --- Blog ---
const blogSource = loader({
  baseUrl: "/blog",
  source: toFumadocsSource(blogCollection, []),
});

export const getBlogPage = (slugs: string[]) => blogSource.getPage(slugs);
export const getBlogPages = () => blogSource.getPages();

// --- Brand ---
const brandSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(brandCollection, []),
});

export const getBrandPage = () => brandSource.getPage(["brand"]);
export const getBrandPages = () => brandSource.getPages();

// --- Home ---
const homeSource = loader({
  baseUrl: "/",
  source: toFumadocsSource(homeCollection, []),
});

export const getHomePage = () => homeSource.getPage(["home"]);
export const getHomePages = () => homeSource.getPages();

// --- Legal ---
const legalSource = loader({
  baseUrl: "/legal",
  source: toFumadocsSource(legalCollection, []),
});

export const getLegalPage = (slugs: string[]) => legalSource.getPage(slugs);
export const getLegalPages = () => legalSource.getPages();
