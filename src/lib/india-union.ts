import india from "@svg-maps/india";
import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";

/**
 * India on the world map is rendered from a real geometric union of every
 * state/UT polygon in @svg-maps/india — a single seamless shape with the
 * correct J&K boundary (@svg-maps/world's own India polygon is missing the
 * Aksai Chin bulge and full northern extent).
 *
 * @svg-maps/india is digitized independently from @svg-maps/world, with a
 * different projection, so no single translate+scale makes every inch of
 * its boundary coincide exactly with its neighbors' polygons in world
 * space. Two earlier approaches tried to fix that precisely and both broke
 * in a different place:
 *  - Fitting the whole union by matching bounding-box corners left the
 *    India-Nepal/Bhutan border "bowed" — touching at both ends, gapping
 *    visibly in the middle.
 *  - Patching only J&K onto @svg-maps/world's own India polygon (to keep
 *    every other border pixel-exact) fixed that gap, but the patch itself
 *    overlapped Pakistan and China — and because of @svg-maps/world's
 *    location order, that overlap wasn't just imprecise, it rendered as
 *    Pakistan's fill visibly cutting into India's J&K bulge.
 *
 * This version sidesteps both failure modes with a rendering-order trick
 * instead of a geometric one: India is drawn as the very last region on the
 * world map (see WorldMap.astro), on top of every other country. That
 * makes any overlap with a neighbor invisible — India simply paints over
 * it — so the fit no longer needs to be conservative. The transform below
 * is deliberately biased to slightly overshoot the India-Nepal/Bhutan
 * border rather than risk falling short of it again; the overshoot is a
 * few tenths of a unit into Nepal/Bhutan/Pakistan/China's territory at
 * most, invisible at map scale, and never a gap.
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

function ringArea(ring: Pair[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
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

// translateX/scale position and size the union to match @svg-maps/world's own
// (now-unused) India polygon; translateY is shifted 6 units further north
// than that match would suggest, specifically so the India-Nepal/Bhutan
// border always meets or slightly overshoots Nepal/Bhutan's own polygons,
// never falls short — verified visually across the full border length.
const INDIA_FIT = { translateX: 668.7978, translateY: 356.8638 - 6, scale: 0.125336 };

function buildMergedIndiaPath(): string {
  const allPolygons = (india as { locations: { path: string }[] }).locations.flatMap((loc) =>
    parsePathToRings(loc.path).map((ring) => [ring])
  );

  const result = polygonClipping.union(allPolygons[0], ...allPolygons.slice(1));

  // Hand-digitized adjacent state borders don't perfectly align, leaving
  // many tiny sliver polygons/holes after the union — filter them out by
  // area (real geography is orders of magnitude larger than the noise).
  const AREA_THRESHOLD = 1;
  const cleaned = result
    .map((polygon) => {
      const [exterior, ...holes] = polygon;
      if (ringArea(exterior) <= AREA_THRESHOLD) return null;
      const keptHoles = holes.filter((h) => ringArea(h) > AREA_THRESHOLD);
      return [exterior, ...keptHoles];
    })
    .filter((p): p is (typeof result)[number] => p !== null);

  const transformed = cleaned.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([x, y]): Pair => [x * INDIA_FIT.scale + INDIA_FIT.translateX, y * INDIA_FIT.scale + INDIA_FIT.translateY])
    )
  );

  return multiPolygonToPathD(transformed);
}

/** Already in @svg-maps/world's own coordinate space — no further transform needed when rendering. */
export const mergedIndiaPath = buildMergedIndiaPath();
