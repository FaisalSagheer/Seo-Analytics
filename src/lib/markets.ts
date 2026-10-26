/**
 * Common DataForSEO / Google Ads location codes. Any code from DataForSEO's
 * locations list works via the API. `gl` is the Google country code Serper needs.
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

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "ur", label: "Urdu" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
] as const;

export function locationLabel(code: number) {
  return LOCATIONS.find((l) => l.code === code)?.label ?? `Location ${code}`;
}

export function countryCode(code: number): string | null {
  return LOCATIONS.find((l) => l.code === code)?.gl ?? null;
}
