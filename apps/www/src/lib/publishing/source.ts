import {
  blogCollection,
  brandCollection,
  homeCollection,
  legalCollection,
} from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";

const blogContent = loader({
  baseUrl: "/blog",
  source: toFumadocsSource(blogCollection, []),
});

const brandContent = loader({
  baseUrl: "/",
  source: toFumadocsSource(brandCollection, []),
});

const homeContent = loader({
  baseUrl: "/",
  source: toFumadocsSource(homeCollection, []),
});

const legalContent = loader({
  baseUrl: "/legal",
  source: toFumadocsSource(legalCollection, []),
});

export const getBlogDocument = (slug: string) => blogContent.getPage([slug]);
export const getBlogDocuments = () => blogContent.getPages();

export const getBrandDocument = () => brandContent.getPage(["brand"]);
export const getBrandDocuments = () => brandContent.getPages();

export const getHomeDocument = () => homeContent.getPage(["home"]);
export const getHomeDocuments = () => homeContent.getPages();

export const getLegalDocument = (slug: string) => legalContent.getPage([slug]);
export const getLegalDocuments = () => legalContent.getPages();
