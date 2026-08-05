/**
 * This site is currently only deployed to the GitHub Pages preview URL, not
 * the eventual apexplores.com domain. `SITE_ENV=production` is the single
 * switch for going live: it flips astro.config.mjs's `site`/`base` to the
 * real domain (root path, no /apexplores-website prefix) and turns off the
 * noindex directives below. Until then, everything defaults to "preview".
 *
 * Set it when running the production build, e.g. `SITE_ENV=production npm run build`,
 * or as an env var on the production deploy workflow.
 */
export const isProductionDeploy = process.env.SITE_ENV === "production";

/** The site's permanent canonical identity, independent of where it's currently hosted. */
export const PRODUCTION_ORIGIN = "https://apexplores.com";

export const SITE_NAME = "AP Explores";

/** Falls back to the homepage hero when a page doesn't have a more specific image. */
export const DEFAULT_OG_IMAGE =
  "https://static.wixstatic.com/media/d10773_f1f0cb91d7654a31beb7960eff33b9a4~mv2.jpg";

/**
 * Builds the canonical URL for a page, always pointing at apexplores.com
 * regardless of whether this build is currently served from GitHub Pages —
 * canonical tags describe the site's intended permanent home, not wherever
 * it's temporarily previewed.
 */
export function getCanonicalUrl(pathname: string, base: string): string {
  const withoutBase = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const normalized = withoutBase.startsWith("/") ? withoutBase : `/${withoutBase}`;
  return `${PRODUCTION_ORIGIN}${normalized}`;
}
