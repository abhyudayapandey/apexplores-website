import worldMap from "@svg-maps/world";
import india from "@svg-maps/india";
import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";

/**
 * @svg-maps/world's own India polygon already shares exact border
 * coordinates with its Nepal/Bhutan/Pakistan/China/Myanmar/Bangladesh
 * neighbors (they're digitized from the same atlas), but its J&K boundary
 * is too narrow — missing the Aksai Chin bulge and full northern extent.
 *
 * @svg-maps/india's state-level dataset has the correct J&K shape, but it's
 * digitized independently with a different projection: fitting its full
 * 36-state union into the world map (via a single translate+scale) leaves
 * the India-Nepal/Bhutan border "bowed" — touching at both ends but gapping
 * visibly in the middle, since a linear transform can't correct for two
 * different projections' curvature.
 *
 * The fix used here avoids both problems: keep @svg-maps/world's own India
 * polygon as-is (so every border with a neighboring country stays exactly
 * where that neighbor's own polygon expects it), and union in just the
 * J&K polygon from @svg-maps/india — fitted with the same translate/scale
 * used previously — as a local patch that only extends the shape in the
 * J&K area.
 *
 * That local fit is not pixel-perfect: measured against @svg-maps/world's
 * own Pakistan and China polygons, the transformed J&K patch overlaps
 * Pakistan by ~29 sq. units and China by ~27 sq. units (out of J&K's own
 * ~182 sq. units) — big enough to be visible. Left alone, this doesn't just
 * look imprecise, it actively renders wrong: China draws before India in
 * @svg-maps/world's location order, so India's fill paints over part of
 * China; Pakistan draws after India, so Pakistan's fill cuts a chunk out of
 * India's J&K bulge. Rather than trying to chase a perfect projection-level
 * fit (the Nepal/Bhutan gap already showed that's not reliable across two
 * independently-digitized datasets), the patch is explicitly clipped
 * against every other country it overlaps before being unioned in — so it
 * can never paint over a neighbor or get painted over by one, regardless of
 * how imprecise the local fit is.
 */

function parsePathToRings(d: string): Pair[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  const rings: Pair[][] = [];
  let i = 0;
  let cx = 0,
    cy = 0;
  let sx = 0,
    sy = 0;
  let ring: Pair[] | null = null;
  let cmd: string | null = null;
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) {
      cmd = tokens[i];
      i++;
    }
    if (cmd === "z" || cmd === "Z") {
      if (ring) {
        if (ring[0][0] !== cx || ring[0][1] !== cy) ring.push([sx, sy]);
        rings.push(ring);
      }
      ring = null;
      cx = sx;
      cy = sy;
      continue;
    }
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    i += 2;
    if (cmd === "m") {
      cx += x;
      cy += y;
      sx = cx;
      sy = cy;
      if (ring) rings.push(ring);
      ring = [[cx, cy]];
      cmd = "l";
    } else if (cmd === "M") {
      cx = x;
      cy = y;
      sx = cx;
      sy = cy;
      if (ring) rings.push(ring);
      ring = [[cx, cy]];
      cmd = "L";
    } else if (cmd === "l") {
      cx += x;
      cy += y;
      ring!.push([cx, cy]);
    } else if (cmd === "L") {
      cx = x;
      cy = y;
      ring!.push([cx, cy]);
    } else {
      throw new Error("Unsupported path command: " + cmd);
    }
  }
  if (ring) rings.push(ring);
  return rings;
}

function bbox(points: Pair[]) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function bboxesOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function multiPolygonToPathD(multiPolygon: MultiPolygon): string {
  const subpaths: string[] = [];
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      const [start, ...rest] = ring;
      const d = `M${start[0]},${start[1]} ` + rest.map((p) => `L${p[0]},${p[1]}`).join(" ") + " Z";
      subpaths.push(d);
    }
  }
  return subpaths.join(" ");
}

// Same local fit used for the (now superseded) full state-union approach —
// still appropriate here since it positions J&K correctly against the
// unchanged Punjab/Himachal/Ladakh-China corner of the world polygon.
const JK_FIT = { translateX: 668.7978, translateY: 356.8638, scale: 0.125336 };

function buildMergedIndiaPath(): string {
  const worldIndia = (worldMap as { locations: { id: string; path: string }[] }).locations.find(
    (loc) => loc.id.toUpperCase() === "IN"
  );
  if (!worldIndia) throw new Error("World map dataset has no India location");
  const worldIndiaPolygons = parsePathToRings(worldIndia.path).map((ring) => [ring]);

  const jk = (india as { locations: { name: string; path: string }[] }).locations.find(
    (loc) => loc.name === "Jammu and Kashmir"
  );
  if (!jk) throw new Error("India states dataset has no Jammu and Kashmir location");
  const jkPolygons: MultiPolygon = parsePathToRings(jk.path).map((ring) => [
    ring.map(([x, y]): Pair => [x * JK_FIT.scale + JK_FIT.translateX, y * JK_FIT.scale + JK_FIT.translateY]),
  ]);
  const jkBBox = bbox(jkPolygons.flat(2) as unknown as Pair[]);

  const otherCountryPolygons = (worldMap as { locations: { id: string; path: string }[] }).locations
    .filter((loc) => loc.id.toUpperCase() !== "IN")
    .flatMap((loc) => parsePathToRings(loc.path).map((ring): [Pair[]] => [ring]))
    .filter((polygon) => bboxesOverlap(bbox(polygon[0]), jkBBox));

  const trimmedJk =
    otherCountryPolygons.length > 0
      ? polygonClipping.difference(jkPolygons, ...otherCountryPolygons)
      : jkPolygons;

  const result = polygonClipping.union(worldIndiaPolygons[0], ...worldIndiaPolygons.slice(1), trimmedJk);
  return multiPolygonToPathD(result);
}

/** Already in @svg-maps/world's own coordinate space — no transform needed when rendering. */
export const mergedIndiaPath = buildMergedIndiaPath();
