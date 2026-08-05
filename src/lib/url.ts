/**
 * Joins Astro's BASE_URL with a path safely. `import.meta.env.BASE_URL` is
 * "/" (trailing slash) when `base` is the site root, but has no trailing
 * slash for any other value (e.g. "/apexplores-website") — naively
 * concatenating `${base}${path}` produces a double slash ("//blog") when
 * base is "/", which browsers parse as a protocol-relative URL to a host
 * named "blog" instead of a same-site path.
 */
export function withBase(path: string, base: string): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
