import { redirect } from "next/navigation";

/** Merged into the Shopping overview: old links and bookmarks land there. */
export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/summary">) {
  const { projectId } = await params;
  const qs = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  
  redirect(`/projects/${projectId}/shopping${qs.size ? `?${qs}` : ""}`);
}
