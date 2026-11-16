/**
 * The database connection, from DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME,
 * or from a single DATABASE_URL, which wins when set. DB_SSL, DB_SSL_CA and
 * DB_CONNECTION_LIMIT apply to either. Plain module with no imports so the app, the
 * Prisma config and the seed script can all share it.
 */
type Source = Record<string, string | undefined>;

export function resolveDatabaseUrl(source: Source = process.env): string {
  const url = source.DATABASE_URL?.trim();
  if (url) return url;

  const host = source.DB_HOST?.trim() || "localhost";
  const port = source.DB_PORT?.trim() || "3306";
  const user = source.DB_USER?.trim() || "root";
  const password = source.DB_PASSWORD ?? "";
  const name = source.DB_NAME?.trim() || "seoengine";

  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`DB_PORT must be a number between 1 and 65535, got "${port}".`);
  }
  // Credentials are percent-encoded so characters like @ : / # in a password can't break the URL
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  // IPv6 hosts need brackets
  const hostPart = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `mysql://${auth}@${hostPart}:${port}/${encodeURIComponent(name)}`;
}

const truthy = (v: string | undefined) => ["true", "1"].includes((v ?? "").trim().toLowerCase());

/** The URL for the Prisma CLI (migrate, seed): the same connection, asking for verified TLS when DB_SSL is on. */
export function resolveCliDatabaseUrl(source: Source = process.env): string {
  const url = resolveDatabaseUrl(source);
  if (!truthy(source.DB_SSL) || /[?&]ssl/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslaccept=strict`;
}

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  /** Present when DB_SSL is on: the server's certificate is verified, against DB_SSL_CA when given */
  ssl?: { rejectUnauthorized: true; ca?: string };
};

/** The connection as options for the mariadb driver, which is the only way to hand it a certificate. */
export function resolveDatabaseConfig(source: Source = process.env): DatabaseConfig {
  const u = new URL(resolveDatabaseUrl(source));
  const config: DatabaseConfig = {
    host: u.hostname.replace(/^\[|\]$/g, ""),
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
  const limit = source.DB_CONNECTION_LIMIT?.trim();
  if (limit) {
    if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1) throw new Error(`DB_CONNECTION_LIMIT must be a whole number from 1 to 999, got "${limit}".`);
    config.connectionLimit = Number(limit);
  }
  if (truthy(source.DB_SSL)) {
    // A pasted PEM often arrives with escaped newlines
    const ca = source.DB_SSL_CA?.trim().replace(/\\n/g, "\n");
    config.ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  }
  return config;
}
