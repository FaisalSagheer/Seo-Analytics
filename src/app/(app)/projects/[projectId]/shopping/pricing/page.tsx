import type { Metadata } from "next";
import { InsightsView } from "@/components/shopping/insights-view";

export const metadata: Metadata = { title: "Pricing" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/pricing">) {
  return <InsightsView projectId={(await params).projectId} sp={await searchParams} report="prices" />;
}
