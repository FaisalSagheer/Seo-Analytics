/**
 * Whether a URL belongs to a Search Console property. Domain properties ("sc-domain:example.com")
 * cover the domain, its subdomains and both http and https; URL-prefix properties
 * ("https://www.example.com/") cover URLs that start with the prefix.
 * Returns the normalised URL, or null when it isn't part of the property.
 */
export function urlInProperty(input: string, property: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  const href = url.toString();
  if (property.startsWith("sc-domain:")) {
    const domain = property.slice("sc-domain:".length).toLowerCase();
    const host = url.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`) ? href : null;
  }
  return href.startsWith(property) ? href : null;
}
