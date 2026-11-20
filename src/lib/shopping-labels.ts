import type { ProductHealthStatus } from "@/lib/providers/google";

/** Shared by the Shopping page (server) and its product health panel (client). */
export const STATUS_LABEL: Record<ProductHealthStatus, string> = {
  APPROVED: "Approved",
  LIMITED: "Limited",
  PENDING: "Pending",
  DISAPPROVED: "Disapproved",
};
