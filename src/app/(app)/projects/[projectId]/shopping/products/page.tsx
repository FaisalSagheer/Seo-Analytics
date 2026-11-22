import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { SearchParamSelect } from "@/components/dashboard/search-param-select";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Catalogue } from "@/components/shopping/catalogue";
import { resolveRange } from "@/lib/date-range";
import type { StoreType } from "@/lib/providers/google";
import { requireProject } from "@/lib/session";
import { loadCatalogue, type MethodFilter } from "@/lib/shopping";

export const metadata: Metadata = { title: "Products" };

const STORE_PARAM: Record<string, StoreType> = { online: "ONLINE_STORE", local: "LOCAL_STORES" };

export default async function ProductsPage({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/products">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const sp = await searchParams;
  const range = resolveRange(sp, 28);
  const method: MethodFilter = sp.method === "ORGANIC" || sp.method === "ADS" ? sp.method : "all";
  const storeValue = typeof sp.store === "string" && sp.store in STORE_PARAM ? sp.store : "all";
  const ready = !project.isDemo && Boolean(project.merchantId);
  const header = (
    <PageHeader
      title="Products"
      description={ready ? "Your catalogue, with how each product performed in the period you pick." : undefined}
      actions={
        ready ? (
          <>
            <SearchParamSelect
              param="method"
              label="Listings"
              value={method}
              items={[
                { value: "all", label: "All listings" },
                { value: "ORGANIC", label: "Free listings" },
                { value: "ADS", label: "Shopping ads" },
              ]}
            />
            <SearchParamSelect
              param="store"
              label="Store"
              value={storeValue}
              items={[
                { value: "all", label: "All stores" },
                { value: "online", label: "Online store" },
                { value: "local", label: "Physical stores" },
              ]}
            />
            <RangePicker value={range.days} />
          </>
        ) : undefined
      }
    />
  );
  if (!ready) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadCatalogue(project, { window: range, method, store: STORE_PARAM[storeValue] });
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <Catalogue projectId={project.id} rows={data.rows} truncated={data.truncated} hasMetrics={data.hasMetrics} />}
    </>
  );
}
