import type { Metadata } from "next";
import { ShoppingAnalytics } from "@/components/shopping/analytics-view";

export const metadata: Metadata = { title: "Product performance" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/product-performance">) {
  return <ShoppingAnalytics projectId={(await params).projectId} sp={await searchParams} view="products" />;
}
