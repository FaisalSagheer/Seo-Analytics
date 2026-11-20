/** The promotion form, shared by the dialog and the server action. */
import { toMicros } from "@/lib/merchant-shipping";
import type { PromotionDoc } from "@/lib/providers/google";

export type PromotionForm = {
  promotionId: string;
  longTitle: string;
  targetCountry: string;
  contentLanguage: string;
  kind: "PERCENT_OFF" | "MONEY_OFF" | "FREE_SHIPPING_STANDARD";
  percentOff: string;
  moneyOff: string;
  currency: string;
  minimumPurchase: string;
  code: string;
  /** yyyy-mm-dd, inclusive */
  start: string;
  end: string;
  itemIds: string;
  destinations: ("SHOPPING_ADS" | "FREE_LISTINGS")[];
  promotionUrl: string;
};

export function checkPromotion(f: PromotionForm): string[] {
  const out: string[] = [];
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(f.promotionId)) out.push("The promotion ID must be 1–50 letters, numbers, dashes or underscores.");
  if (!f.longTitle.trim()) out.push("Add a title shoppers will see.");
  if (f.longTitle.length > 60) out.push("The title can be at most 60 characters.");
  if (!/^[A-Z]{2}$/.test(f.targetCountry)) out.push("The country must be a 2-letter code, e.g. PK.");
  if (!/^[a-z]{2}$/.test(f.contentLanguage)) out.push("The language must be a 2-letter code, e.g. en.");
  if (f.kind === "PERCENT_OFF" && !(Number.isInteger(Number(f.percentOff)) && Number(f.percentOff) >= 1 && Number(f.percentOff) <= 99)) out.push("The discount must be a whole percent from 1 to 99.");
  if (f.kind === "MONEY_OFF" && !(toMicros(f.moneyOff) && Number(f.moneyOff) > 0)) out.push("Enter the amount off.");
  if ((f.kind === "MONEY_OFF" || f.minimumPurchase.trim()) && !/^[A-Z]{3}$/.test(f.currency)) out.push("Add the 3-letter currency, e.g. PKR.");
  if (f.minimumPurchase.trim() && !toMicros(f.minimumPurchase)) out.push("The minimum purchase must be a number.");
  if (f.code && !/^[A-Za-z0-9_-]{1,20}$/.test(f.code)) out.push("The code must be up to 20 letters, numbers, dashes or underscores.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start) || !/^\d{4}-\d{2}-\d{2}$/.test(f.end)) out.push("Choose the start and end dates.");
  else if (f.end < f.start) out.push("The end date must be on or after the start date.");
  if (f.destinations.length === 0) out.push("Choose where the promotion shows.");
  if (f.promotionUrl.trim() && !/^https?:\/\/[^\s]+$/i.test(f.promotionUrl.trim())) out.push("The promotion page must start with http:// or https://.");
  return out;
}

/** The API promotion for a valid form. Dates run from the start of the start day to the end of the end day, UTC. */
export function toPromotion(f: PromotionForm): PromotionDoc {
  const ids = f.itemIds.split(",").map((s) => s.trim()).filter(Boolean);
  const end = new Date(`${f.end}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    promotionId: f.promotionId,
    targetCountry: f.targetCountry,
    contentLanguage: f.contentLanguage,
    redemptionChannel: ["ONLINE"],
    attributes: {
      longTitle: f.longTitle.trim(),
      couponValueType: f.kind,
      percentOff: f.kind === "PERCENT_OFF" ? String(Number(f.percentOff)) : undefined,
      moneyOffAmount: f.kind === "MONEY_OFF" ? { amountMicros: toMicros(f.moneyOff), currencyCode: f.currency } : undefined,
      minimumPurchaseAmount: f.minimumPurchase.trim() ? { amountMicros: toMicros(f.minimumPurchase), currencyCode: f.currency } : undefined,
      offerType: f.code ? "GENERIC_CODE" : "NO_CODE",
      genericRedemptionCode: f.code || undefined,
      productApplicability: ids.length ? "SPECIFIC_PRODUCTS" : "ALL_PRODUCTS",
      itemIdInclusion: ids.length ? ids : undefined,
      promotionDestinations: f.destinations,
      promotionEffectiveTimePeriod: { startTime: `${f.start}T00:00:00Z`, endTime: end.toISOString().replace(".000", "") },
      promotionUrl: f.promotionUrl.trim() || undefined,
    },
  };
}
