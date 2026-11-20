import type { Metadata } from "next";
import { InsightsView } from "@/components/shopping/insights-view";

export const metadata: Metadata = { title: "Best sellers" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/best-sellers">) {
  return <InsightsView projectId={(await params).projectId} sp={await searchParams} report="sellers" />;
}
