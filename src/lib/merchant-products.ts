/** Product attributes the app edits, shared by the server actions and the product form. */
import { fromMicros, toMicros } from "@/lib/merchant-shipping";

export const AVAILABILITY = ["IN_STOCK", "OUT_OF_STOCK", "PREORDER", "BACKORDER", "LIMITED_AVAILABILITY"] as const;
export const CONDITION = ["NEW", "USED", "REFURBISHED"] as const;

/** The form's view of a product: plain strings, amounts in the currency's units. */
export type ProductForm = {
  title: string;
  description: string;
  link: string;
  imageLink: string;
  price: string;
  salePrice: string;
  currency: string;
  availability: string;
  condition: string;
  brand: string;
  gtins: string;
};
export type FormField = Exclude<keyof ProductForm, "currency">;

/** Which API attribute each form field writes. Price and sale price share the currency. */
export const ATTRIBUTE: Record<FormField, string> = {
  title: "title",
  description: "description",
  link: "link",
  imageLink: "imageLink",
  price: "price",
  salePrice: "salePrice",
  availability: "availability",
  condition: "condition",
  brand: "brand",
  gtins: "gtins",
};

type Price = { amountMicros?: string; currencyCode?: string };
type Attrs = Record<string, unknown>;

export function toForm(a: Attrs | undefined): ProductForm {
  const at = a ?? {};
  const price = at.price as Price | undefined;
  const sale = at.salePrice as Price | undefined;
  return {
    title: (at.title as string) ?? "",
    description: (at.description as string) ?? "",
    link: (at.link as string) ?? "",
    imageLink: (at.imageLink as string) ?? "",
    price: fromMicros(price?.amountMicros),
    salePrice: fromMicros(sale?.amountMicros),
    currency: price?.currencyCode ?? sale?.currencyCode ?? "",
    availability: (at.availability as string) ?? "",
    condition: (at.condition as string) ?? "",
    brand: (at.brand as string) ?? "",
    gtins: ((at.gtins as string[]) ?? []).join(", "),
  };
}

/** The API value of one field; `undefined` means "remove it". */
export function attributeValue(f: ProductForm, field: FormField): unknown {
  const v = f[field].trim();
  if (!v) return undefined;
  if (field === "price" || field === "salePrice") return { amountMicros: toMicros(v), currencyCode: f.currency.trim().toUpperCase() };
  if (field === "gtins") return v.split(",").map((g) => g.trim()).filter(Boolean);
  return v;
}

/** Fields whose value differs between two forms; a currency change counts for both prices. */
export function changedFields(before: ProductForm, after: ProductForm): FormField[] {
  return (Object.keys(ATTRIBUTE) as FormField[]).filter(
    (k) => before[k].trim() !== after[k].trim() || ((k === "price" || k === "salePrice") && after[k].trim() && before.currency !== after.currency),
  );
}

/** Problems that would make Google reject the product, checked before sending. */
export function checkProduct(f: ProductForm, { isNew }: { isNew: boolean }): string[] {
  const out: string[] = [];
  const url = (s: string) => /^https?:\/\/[^\s]+$/i.test(s);
  if (isNew) {
    if (!f.title.trim()) out.push("Add a title.");
    if (!f.link.trim()) out.push("Add the product page link.");
    if (!f.imageLink.trim()) out.push("Add an image link.");
    if (!f.price.trim()) out.push("Add a price.");
    if (!f.availability) out.push("Choose the availability.");
  }
  if (f.title.length > 150) out.push("The title can be at most 150 characters.");
  if (f.description.length > 5000) out.push("The description can be at most 5,000 characters.");
  if (f.link.trim() && !url(f.link.trim())) out.push("The product link must start with http:// or https://.");
  if (f.imageLink.trim() && !url(f.imageLink.trim())) out.push("The image link must start with http:// or https://.");
  for (const [k, label] of [["price", "price"], ["salePrice", "sale price"]] as const) {
    if (f[k].trim() && toMicros(f[k].trim()) == null) out.push(`The ${label} must be a number.`);
  }
  if ((f.price.trim() || f.salePrice.trim()) && !/^[A-Z]{3}$/.test(f.currency.trim().toUpperCase())) out.push("Add the 3-letter currency, e.g. PKR.");
  const p = Number(f.price), sp = Number(f.salePrice);
  if (f.price.trim() && f.salePrice.trim() && sp >= p) out.push("The sale price must be lower than the price.");
  if (f.availability && !(AVAILABILITY as readonly string[]).includes(f.availability)) out.push("Choose a valid availability.");
  if (f.condition && !(CONDITION as readonly string[]).includes(f.condition)) out.push("Choose a valid condition.");
  for (const g of f.gtins.split(",").map((x) => x.trim()).filter(Boolean)) {
    if (!/^\d{8}$|^\d{12,14}$/.test(g)) out.push(`GTIN "${g}" must be 8, 12, 13 or 14 digits.`);
  }
  return out;
}

/** An offer id Google accepts: up to 50 characters, no spaces at the ends. */
export const validOfferId = (id: string) => id.length > 0 && id.length <= 50 && id === id.trim();

/** The product input id, `lang~label~offer`, base64url encoded (unpadded) so any offer id is safe in the URL. Server only. */
export function inputSegment(contentLanguage: string, feedLabel: string, offerId: string): string {
  return Buffer.from(`${contentLanguage}~${feedLabel}~${offerId}`, "utf8").toString("base64url");
}
