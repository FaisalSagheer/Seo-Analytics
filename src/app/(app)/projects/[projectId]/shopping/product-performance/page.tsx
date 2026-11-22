import { redirect } from "next/navigation";

/** Merged into Products (clicks, impressions, CTR and conversions are columns there): old links land there. */
export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/product-performance">) {
  const { projectId } = await params;
  const qs = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  redirect(`/projects/${projectId}/shopping/products${qs.size ? `?${qs}` : ""}`);
}
