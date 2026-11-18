import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The Analytics page was renamed to Reports; keep old links working
  async redirects() {
    return [{ source: "/projects/:projectId/analytics", destination: "/projects/:projectId/reports", permanent: true }];
  },
  experimental: {
    // Every dashboard route sits behind a per-user session, so there is no
    // static shell to validate automatically. Segments can still opt in with
    // `export const instant = true`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
