/**
 * Regenerates src/data/world-map.ts from Natural Earth's "India POV" Admin-0
 * Countries dataset (public domain, https://www.naturalearthdata.com).
 *
 * Why this dataset: it's a single, internally-consistent set of country
 * polygons where every shared border is digitized once and reused by both
 * neighbors, so two adjacent countries can never gap or overlap against
 * each other — unlike stitching @svg-maps/world (one digitization) together
 * with a separately-digitized India shape, which is what caused the
 * repeated India/Nepal/Pakistan border bugs this replaces. The "_ind"
 * variant additionally renders India's boundary per India's own official
 * claim (full J&K/Aksai Chin extent) rather than the de facto Line of
 * Control most Western atlases show — still using the exact same shared
 * border geometry as its neighbors, so nothing needs patching afterward.
 *
 * This script is *not* run as part of the build. It's a one-off/occasional
 * maintenance script — run it manually if Natural Earth publishes an
 * updated dataset. It needs a few packages not otherwise used by the site,
 * so install them ephemerally first:
 *
 *   npm install --no-save shpjs d3-geo topojson-server topojson-simplify topojson-client
 *   curl -L -o /tmp/ne_ind.zip https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries_ind.zip
 *   mkdir -p /tmp/ne_ind && unzip -o /tmp/ne_ind.zip -d /tmp/ne_ind
 *   node scripts/generate-world-map.mjs /tmp/ne_ind/ne_10m_admin_0_countries_ind
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { combine, parseShp, parseDbf } from "shpjs";
import { geoPath, geoEquirectangular } from "d3-geo";
import topojsonServer from "topojson-server";
import topojsonSimplify from "topojson-simplify";
import topojsonClient from "topojson-client";

const { topology } = topojsonServer;
const { presimplify, simplify } = topojsonSimplify;
const { feature } = topojsonClient;

const shpBase = process.argv[2];
if (!shpBase) {
  console.error("Usage: node generate-world-map.mjs <path-to-shapefile-base-without-extension>");
  process.exit(1);
}

const shpBuf = fs.readFileSync(shpBase + ".shp");
const dbfBuf = fs.readFileSync(shpBase + ".dbf");
const geojson = combine([parseShp(shpBuf), parseDbf(dbfBuf)]);

// Drop Antarctica — the rest of the site's maps never show it.
geojson.features = geojson.features.filter((f) => f.properties.ISO_A2 !== "AQ");

// Topology-preserving simplification: shared borders are simplified once as
// a single shared arc, so simplification can't reintroduce gaps between
// neighbors the way independently simplifying each country's polygon would.
let topo = topology({ countries: geojson }, 1e5);
topo = presimplify(topo);
const simplified = simplify(topo, 0.05);
const fc = feature(simplified, simplified.objects.countries);

// A few countries' single "Country"-typed feature is itself a MultiPolygon
// that includes overseas departments thousands of km from the mainland
// (e.g. France's geometry bundles in French Guiana and Réunion — they're
// legally part of France, but a stray dot near Venezuela reads as a map
// bug, not as "visited France"). Unlike genuinely spread-out archipelago
// nations (Indonesia, the Philippines), where every island belongs on the
// map, these are a handful of known, specific cases — so this is an
// explicit per-country allowlist of the lon/lat box to keep, not a
// generic distance heuristic that could wrongly amputate a real country.
const GEOMETRY_BBOX_OVERRIDES = {
  // Metropolitan France + Corsica + nearby Atlantic coastal islands.
  FR: { lonMin: -10, lonMax: 15, latMin: 40, latMax: 52 },
};

function cropToBBox(geometry, bbox) {
  if (geometry.type !== "MultiPolygon") return geometry;
  const kept = geometry.coordinates.filter((polygon) => {
    const ring = polygon[0];
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    return cx >= bbox.lonMin && cx <= bbox.lonMax && cy >= bbox.latMin && cy <= bbox.latMax;
  });
  return { type: "MultiPolygon", coordinates: kept };
}

for (const f of fc.features) {
  const code = resolveCode(f.properties);
  const bbox = code && GEOMETRY_BBOX_OVERRIDES[code];
  if (bbox) f.geometry = cropToBBox(f.geometry, bbox);
}

const WIDTH = 1010;
const HEIGHT = 505;
const projection = geoEquirectangular()
  .scale(WIDTH / (2 * Math.PI))
  .translate([WIDTH / 2, HEIGHT / 2]);
const svgPath = geoPath(projection);

function resolveCode(props) {
  if (props.ISO_A2 && props.ISO_A2 !== "-99") return props.ISO_A2;
  if (props.ISO_A2_EH && props.ISO_A2_EH !== "-99") return props.ISO_A2_EH;
  return null;
}

// Group by ISO code first: a handful of entries (e.g. France + Clipperton
// Island) share a code with a remote dependency, and should render as one
// clickable region rather than two.
const byCode = new Map();
for (const f of fc.features) {
  const code = resolveCode(f.properties);
  if (!code) continue;
  if (!byCode.has(code)) byCode.set(code, []);
  byCode.get(code).push(f);
}

const MAIN_TYPES = new Set(["Country", "Sovereign country"]);

const locations = [...byCode.entries()]
  .map(([code, allFeatures]) => {
    // When a code covers both a main country and remote dependencies (e.g.
    // France + Clipperton Island), keep only the main one — a stray dot on
    // the other side of the world reads as a bug, not as "visited France."
    // Standalone entries with no distinguishable "main" type (a few, like
    // Cuba, are typed "Sovereignty" rather than "Country") are left as-is.
    const mainOnly = allFeatures.filter((f) => MAIN_TYPES.has(f.properties.TYPE));
    const features = mainOnly.length > 0 ? mainOnly : allFeatures;

    const d = features
      .map((f) => svgPath(f))
      .filter(Boolean)
      .join(" ");
    if (!d) return null;
    return { id: code.toLowerCase(), name: features[0].properties.NAME, path: d };
  })
  .filter((loc) => loc !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

const out = {
  viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
  label: "Map of World",
  locations,
};

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data/world-map.ts");
const header = `// Generated by scripts/generate-world-map.mjs from Natural Earth's India-POV
// Admin-0 Countries dataset (public domain). Do not hand-edit — regenerate
// with the script instead. See that file for why this dataset was chosen.
`;
fs.writeFileSync(
  outPath,
  header +
    `export const worldMap = ${JSON.stringify(out)} as const;\n`
);
console.log(`Wrote ${locations.length} locations to ${outPath}`);
