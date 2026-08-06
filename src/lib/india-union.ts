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
 * J&K area. Any imprecision in that local fit only affects the
 * Pakistan/China corner immediately around J&K, not the Nepal/Bhutan
 * border along the rest of the country.
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
  const jkPolygons = parsePathToRings(jk.path).map((ring) => [
    ring.map(([x, y]): Pair => [x * JK_FIT.scale + JK_FIT.translateX, y * JK_FIT.scale + JK_FIT.translateY]),
  ]);

  const result = polygonClipping.union(worldIndiaPolygons[0], ...worldIndiaPolygons.slice(1), ...jkPolygons);
  return multiPolygonToPathD(result);
}

/** Already in @svg-maps/world's own coordinate space — no transform needed when rendering. */
export const mergedIndiaPath = buildMergedIndiaPath();
