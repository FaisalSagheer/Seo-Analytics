import type { Metadata } from "next";
import { ShoppingAnalytics } from "@/components/shopping/analytics-view";

export const metadata: Metadata = { title: "Physical stores" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/physical-stores">) {
  return <ShoppingAnalytics projectId={(await params).projectId} sp={await searchParams} view="local" />;
}
