/**
 * Markets a project can target. `code` is the Google Ads location code stored on the
 * project, `gl` the two-letter country code. Search Console filters by country, see gscCountry below.
 */
export const LOCATIONS = [
  { code: 2840, gl: "us", label: "United States" },
  { code: 2826, gl: "gb", label: "United Kingdom" },
  { code: 2124, gl: "ca", label: "Canada" },
  { code: 2036, gl: "au", label: "Australia" },
  { code: 2276, gl: "de", label: "Germany" },
  { code: 2250, gl: "fr", label: "France" },
  { code: 2724, gl: "es", label: "Spain" },
  { code: 2380, gl: "it", label: "Italy" },
  { code: 2528, gl: "nl", label: "Netherlands" },
  { code: 2356, gl: "in", label: "India" },
  { code: 2586, gl: "pk", label: "Pakistan" },
  { code: 2784, gl: "ae", label: "United Arab Emirates" },
  { code: 2682, gl: "sa", label: "Saudi Arabia" },
  { code: 2076, gl: "br", label: "Brazil" },
  { code: 2484, gl: "mx", label: "Mexico" },
  { code: 2392, gl: "jp", label: "Japan" },
] as const;

export function locationLabel(code: number) {
  return LOCATIONS.find((l) => l.code === code)?.label ?? `Location ${code}`;
}

export function countryCode(code: number): string | null {
  return LOCATIONS.find((l) => l.code === code)?.gl ?? null;
}

/** ISO 3166-1 alpha-3 codes, which Search Console's country filter wants, keyed by the alpha-2 `gl` above. */
const ALPHA3: Record<string, string> = {
  us: "USA", gb: "GBR", ca: "CAN", au: "AUS", de: "DEU", fr: "FRA", es: "ESP", it: "ITA",
  nl: "NLD", in: "IND", pk: "PAK", ae: "ARE", sa: "SAU", br: "BRA", mx: "MEX", jp: "JPN",
};

/** Search Console country code (ISO alpha-3) for a project location code, or undefined for an unlisted market. */
export function gscCountry(locationCode: number): string | undefined {
  const gl = LOCATIONS.find((l) => l.code === locationCode)?.gl;
  return gl ? ALPHA3[gl] : undefined;
}
