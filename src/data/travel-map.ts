export interface VisitedPlace {
  name: string;
  slug: string;
  /** Set only when a story already exists; otherwise the place routes to /destinations/[slug]. */
  href?: string;
}

/** Visited countries on the world map, keyed by ISO 3166-1 alpha-2 code (matches @svg-maps/world location ids). */
export const visitedCountries: Record<string, VisitedPlace> = {
  IN: { name: "India", slug: "india" },
  NP: { name: "Nepal", slug: "nepal" },
  BT: { name: "Bhutan", slug: "bhutan", href: "/blog/bhutan-the-land-of-the-thunder-dragon" },
  LK: { name: "Sri Lanka", slug: "sri-lanka" },
  ID: { name: "Indonesia", slug: "indonesia" },
  VN: { name: "Vietnam", slug: "vietnam" },
  SG: { name: "Singapore", slug: "singapore" },
  TH: { name: "Thailand", slug: "thailand" },
  OM: { name: "Oman", slug: "oman" },
  SA: { name: "Saudi Arabia", slug: "saudi-arabia" },
  CZ: { name: "Czech Republic", slug: "czech-republic" },
  AT: { name: "Austria", slug: "austria" },
  SK: { name: "Slovakia", slug: "slovakia" },
  FR: { name: "France", slug: "france" },
  CH: { name: "Switzerland", slug: "switzerland" },
  DE: { name: "Germany", slug: "germany" },
  LU: { name: "Luxembourg", slug: "luxembourg" },
  BE: { name: "Belgium", slug: "belgium" },
  GR: { name: "Greece", slug: "greece" },
  TR: { name: "Turkey", slug: "turkey" },
};

/** Visited states/UTs on the India map, keyed by name (matches @svg-maps/india location names). */
export const visitedStates: Record<string, VisitedPlace> = {
  "Uttar Pradesh": { name: "Uttar Pradesh", slug: "uttar-pradesh" },
  "Andhra Pradesh": { name: "Andhra Pradesh", slug: "andhra-pradesh" },
  Assam: { name: "Assam", slug: "assam" },
  Goa: { name: "Goa", slug: "goa", href: "/blog/categories/goa" },
  Gujarat: { name: "Gujarat", slug: "gujarat" },
  Haryana: { name: "Haryana", slug: "haryana" },
  "Himachal Pradesh": {
    name: "Himachal Pradesh",
    slug: "himachal-pradesh",
    href: "/blog/the-busiest-82-hours-of-my-life-yet",
  },
  Karnataka: { name: "Karnataka", slug: "karnataka" },
  Kerala: { name: "Kerala", slug: "kerala" },
  "Madhya Pradesh": { name: "Madhya Pradesh", slug: "madhya-pradesh" },
  Maharashtra: { name: "Maharashtra", slug: "maharashtra" },
  Manipur: { name: "Manipur", slug: "manipur" },
  Mizoram: { name: "Mizoram", slug: "mizoram" },
  Meghalaya: { name: "Meghalaya", slug: "meghalaya" },
  Rajasthan: { name: "Rajasthan", slug: "rajasthan" },
  "Tamil Nadu": {
    name: "Tamil Nadu",
    slug: "tamil-nadu",
    href: "/blog/backpacking-to-the-tip-of-india-in-inr-5-000",
  },
  Telangana: { name: "Telangana", slug: "telangana" },
  Uttarakhand: { name: "Uttarakhand", slug: "uttarakhand" },
  "West Bengal": { name: "West Bengal", slug: "west-bengal", href: "/blog/wfh-work-from-himalayas" },
  Chandigarh: { name: "Chandigarh", slug: "chandigarh" },
  Delhi: { name: "Delhi", slug: "delhi" },
  Puducherry: { name: "Puducherry", slug: "puducherry" },
};

/** Every visited place that doesn't have a story yet — these get a /destinations/[slug] page. */
export const destinationPlaces: VisitedPlace[] = [
  ...Object.values(visitedCountries),
  ...Object.values(visitedStates),
].filter((place) => !place.href);
