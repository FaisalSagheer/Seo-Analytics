import { NextResponse } from "next/server";

const projectId = { name: "projectId", in: "path", required: true, schema: { type: "string" } };
const days = (d: number) => ({ name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365, default: d } });
const ok = (description: string) => ({ 200: { description }, 401: { description: "Missing or invalid API key" }, 404: { description: "Project not found" } });

/** Public, unauthenticated: so agents and tools can discover the API. */
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Seo Engine API",
      version: "1.0.0",
      description:
        "Read SEO reports, ranking history, backlinks and domain data for your projects. Authenticate with an API key from Settings → Providers & API.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ bearer: [] }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "API key (bsk_...)" } } },
    paths: {
      "/projects": { get: { summary: "List projects", operationId: "listProjects", responses: ok("Projects") } },
      "/projects/{projectId}/report": {
        get: {
          summary: "Overview report: totals, daily GSC + GA4 + ranking series, top movers",
          operationId: "getReport",
          parameters: [projectId, days(28)],
          responses: ok("Report"),
        },
      },
      "/projects/{projectId}/rankings": {
        get: {
          summary: "Ranking history per tracked keyword",
          operationId: "getRankings",
          parameters: [
            projectId,
            days(28),
            { name: "keyword", in: "query", schema: { type: "string" }, description: "Substring match" },
            { name: "tag", in: "query", schema: { type: "string" } },
          ],
          responses: ok("Rankings"),
        },
      },
      "/projects/{projectId}/keywords": {
        get: { summary: "List tracked keywords", operationId: "listKeywords", parameters: [projectId], responses: ok("Keywords") },
        post: {
          summary: "Track new keywords (checked on next sync)",
          operationId: "addKeywords",
          parameters: [projectId],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["keywords"],
                  properties: {
                    keywords: { type: "array", items: { type: "string" }, maxItems: 500 },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Added" }, 400: { description: "Invalid body" } },
        },
      },
      "/projects/{projectId}/backlinks": {
        get: { summary: "Strongest backlinks (sample of 200)", operationId: "getBacklinks", parameters: [projectId], responses: ok("Backlinks") },
      },
      "/projects/{projectId}/domain": {
        get: {
          summary: "Domain snapshots over time and top pages",
          operationId: "getDomain",
          parameters: [projectId, days(180)],
          responses: ok("Domain data"),
        },
      },
    },
  });
}
