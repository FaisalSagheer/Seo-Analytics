import type { Metadata } from "next";
import { ShoppingAnalytics } from "@/components/shopping/analytics-view";

export const metadata: Metadata = { title: "Online store" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/online-store">) {
  return <ShoppingAnalytics projectId={(await params).projectId} sp={await searchParams} view="online" />;
}
