import india from "@svg-maps/india";
import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";

/**
 * Merges every India state/UT polygon from @svg-maps/india into a single
 * seamless shape via a real geometric union, instead of rendering each
 * state as a separate stroked path (visible seams) or falling back to
 * @svg-maps/world's own India polygon (incorrect, narrower J&K boundary).
 * Computed once at build time — the union itself takes ~300ms.
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

  return multiPolygonToPathD(cleaned);
}

export const mergedIndiaPath = buildMergedIndiaPath();
