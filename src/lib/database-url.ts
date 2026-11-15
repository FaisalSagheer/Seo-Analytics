/**
 * The database connection, from DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME,
 * or from a single DATABASE_URL, which wins when set. Plain module with no imports so
 * the app, the Prisma config and the seed script can all share it.
 */
type Source = Record<string, string | undefined>;

export function resolveDatabaseUrl(source: Source = process.env): string {
  const url = source.DATABASE_URL?.trim();
  if (url) return url;

  const host = source.DB_HOST?.trim() || "localhost";
  const port = source.DB_PORT?.trim() || "3306";
  const user = source.DB_USER?.trim() || "root";
  const password = source.DB_PASSWORD ?? "";
  const name = source.DB_NAME?.trim() || "bisibility";

  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`DB_PORT must be a number between 1 and 65535, got "${port}".`);
  }
  // Credentials are percent-encoded so characters like @ : / # in a password can't break the URL
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  // IPv6 hosts need brackets
  const hostPart = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `mysql://${auth}@${hostPart}:${port}/${encodeURIComponent(name)}`;
}
