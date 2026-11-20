import type { Metadata } from "next";
import { ShoppingAnalytics } from "@/components/shopping/analytics-view";

export const metadata: Metadata = { title: "Summary" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/summary">) {
  return <ShoppingAnalytics projectId={(await params).projectId} sp={await searchParams} view="summary" />;
}
