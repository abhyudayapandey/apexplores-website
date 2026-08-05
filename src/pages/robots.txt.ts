import type { APIRoute } from "astro";
import { isProductionDeploy } from "../lib/seo";

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL("sitemap-index.xml", site).href;
  const body = isProductionDeploy
    ? `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
