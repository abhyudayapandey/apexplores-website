// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// See src/lib/seo.ts for what this flips when the site actually launches on
// apexplores.com: site/base here (so sitemap.xml and built asset paths match
// the real domain instead of the GitHub Pages preview), and the noindex
// directives in Layout.astro / robots.txt.
const isProductionDeploy = process.env.SITE_ENV === "production";

export default defineConfig({
  site: isProductionDeploy ? "https://apexplores.com" : "https://abhyudayapandey.github.io",
  base: isProductionDeploy ? "/" : "/apexplores-website",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
