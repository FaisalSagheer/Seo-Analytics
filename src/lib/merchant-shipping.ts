/**
 * Merchant Center shipping settings and return policies, typed as the Merchant API v1 sends them
 * (accounts_v1 discovery document), plus the checks run before saving. Shared by server and browser.
 */

export type Price = { amountMicros?: string; currencyCode?: string };
export type Weight = { amountMicros?: string; unit?: "POUND" | "KILOGRAM" };
export type BusinessDays = { businessDays?: ("MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY")[] };

export type Value = { flatRate?: Price; pricePercentage?: string; noShipping?: boolean; carrierRate?: string; subtable?: string };
export type Headers = {
  prices?: Price[];
  weights?: Weight[];
  numberOfItems?: string[];
  postalCodeGroupNames?: string[];
  locations?: { locationIds?: string[] }[];
};
export type Table = { name?: string; rowHeaders?: Headers; columnHeaders?: Headers; rows?: { cells?: Value[] }[] };
export type CarrierRate = { name?: string; carrier?: string; carrierService?: string; originPostalCode?: string; percentageAdjustment?: string; flatAdjustment?: Price };
export type RateGroup = {
  name?: string;
  applicableShippingLabels?: string[];
  singleValue?: Value;
  mainTable?: Table;
  subtables?: Table[];
  carrierRates?: CarrierRate[];
};
export type TransitTable = {
  postalCodeGroupNames?: string[];
  transitTimeLabels?: string[];
  rows?: { values?: { minTransitDays?: number; maxTransitDays?: number }[] }[];
};
export type DeliveryTime = {
  minHandlingDays?: number;
  maxHandlingDays?: number;
  minTransitDays?: number;
  maxTransitDays?: number;
  cutoffTime?: { hour?: number; minute?: number; timeZone?: string };
  handlingBusinessDayConfig?: BusinessDays;
  transitBusinessDayConfig?: BusinessDays;
  transitTimeTable?: TransitTable;
  warehouseBasedDeliveryTimes?: { warehouse?: string; carrier?: string; carrierService?: string }[];
};
export type StoreConfig = {
  storeServiceType?: "ALL_STORES" | "SELECTED_STORES";
  storeCodes?: string[];
  serviceRadius?: { value?: string; unit?: "MILES" | "KILOMETERS" };
  cutoffConfig?: { localCutoffTime?: { hour?: string; minute?: string }; storeCloseOffsetHours?: string; noDeliveryPostCutoff?: boolean };
};
export type Service = {
  serviceName?: string;
  active?: boolean;
  shipmentType?: "DELIVERY" | "LOCAL_DELIVERY" | "COLLECTION_POINT";
  deliveryCountries?: string[];
  currencyCode?: string;
  deliveryTime?: DeliveryTime;
  rateGroups?: RateGroup[];
  minimumOrderValue?: Price;
  minimumOrderValueTable?: { storeCodeSetWithMovs?: { storeCodes?: string[]; value?: Price }[] };
  storeConfig?: StoreConfig;
  loyaltyPrograms?: { programLabel?: string; loyaltyProgramTiers?: { tierLabel?: string }[] }[];
};
export type Warehouse = {
  name?: string;
  shippingAddress?: { streetAddress?: string; city?: string; administrativeArea?: string; postalCode?: string; regionCode?: string };
  cutoffTime?: { hour?: number; minute?: number };
  handlingDays?: string;
  businessDayConfig?: BusinessDays;
};
export type ShippingSettings = { name?: string; services?: Service[]; warehouses?: Warehouse[]; etag?: string };

export type Region = {
  name?: string;
  displayName?: string;
  postalCodeArea?: { regionCode?: string; postalCodes?: { begin?: string; end?: string }[] };
  geotargetArea?: { geotargetCriteriaIds?: string[] };
  radiusArea?: Record<string, unknown>;
  shippingEligible?: boolean;
  regionalInventoryEligible?: boolean;
};

type GDate = { year?: number; month?: number; day?: number };
export type ReturnPolicy = {
  name?: string;
  returnPolicyId?: string;
  label?: string;
  countries?: string[];
  policy?: { type?: "NUMBER_OF_DAYS_AFTER_DELIVERY" | "NO_RETURNS" | "LIFETIME_RETURNS"; days?: string };
  itemConditions?: ("NEW" | "USED")[];
  returnMethods?: ("BY_MAIL" | "IN_STORE" | "AT_A_KIOSK")[];
  returnShippingFee?: { type?: "FIXED" | "CUSTOMER_PAYING_ACTUAL_FEE"; fixedFee?: Price };
  restockingFee?: { fixedFee?: Price; microPercent?: number };
  returnLabelSource?: "DOWNLOAD_AND_PRINT" | "IN_THE_PACKAGE" | "CUSTOMER_RESPONSIBILITY";
  acceptExchange?: boolean;
  acceptDefectiveOnly?: boolean;
  processRefundDays?: number;
  returnPolicyUri?: string;
  seasonalOverrides?: { label?: string; startDate?: GDate; endDate?: GDate; returnDays?: number; returnUntilDate?: GDate }[];
};

// ---- money and numbers ----

const MILLION = BigInt(1_000_000);

/** "12.5" -> "12500000". Returns undefined for an empty or invalid entry. */
export function toMicros(decimal: string): string | undefined {
  const t = decimal.trim();
  if (!/^-?\d+(\.\d{1,6})?$/.test(t)) return undefined;
  const [whole, frac = ""] = t.replace("-", "").split(".");
  const micros = BigInt(whole) * MILLION + BigInt((frac + "000000").slice(0, 6));
  return (t.startsWith("-") ? -micros : micros).toString();
}

/** "12500000" -> "12.5"; -1 (infinity in headers) -> "" */
export function fromMicros(micros: string | undefined): string {
  if (micros == null || micros === "" || micros === "-1") return "";
  const n = BigInt(micros);
  const neg = n < BigInt(0);
  const abs = neg ? -n : n;
  const frac = (abs % MILLION).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${abs / MILLION}${frac ? `.${frac}` : ""}`;
}

export const INFINITY_MICROS = "-1";

/** What a value cell shows, for read-only views and summaries. */
export function describeValue(v: Value | undefined): string {
  if (!v) return "—";
  if (v.noShipping) return "No shipping";
  if (v.flatRate) return v.flatRate.amountMicros === "0" ? "Free" : `${fromMicros(v.flatRate.amountMicros)} ${v.flatRate.currencyCode ?? ""}`.trim();
  if (v.pricePercentage != null) return `${v.pricePercentage}% of price`;
  if (v.carrierRate) return `Carrier rate: ${v.carrierRate}`;
  if (v.subtable) return `Subtable: ${v.subtable}`;
  return "—";
}

// ---- checks before saving ----

const headerSize = (h: Headers | undefined) =>
  !h ? 1 : (h.prices?.length ?? h.weights?.length ?? h.numberOfItems?.length ?? h.postalCodeGroupNames?.length ?? h.locations?.length ?? 0);
const headerKinds = (h: Headers) => (["prices", "weights", "numberOfItems", "postalCodeGroupNames", "locations"] as const).filter((k) => h[k] != null);

function checkValue(v: Value | undefined, where: string, ctx: { currency?: string; carriers: Set<string>; subtables: Set<string>; inTable: boolean }, out: string[]) {
  if (!v) return out.push(`${where}: choose a rate.`);
  const set = [v.flatRate != null, v.pricePercentage != null, v.noShipping === true, v.carrierRate != null, v.subtable != null].filter(Boolean).length;
  if (set !== 1) return out.push(`${where}: a rate must be exactly one of flat rate, % of price, no shipping, carrier rate or subtable.`);
  if (v.flatRate) {
    if (v.flatRate.amountMicros == null || v.flatRate.amountMicros === "") out.push(`${where}: enter an amount.`);
    if (ctx.currency && v.flatRate.currencyCode !== ctx.currency) out.push(`${where}: the amount must be in the service currency (${ctx.currency}).`);
  }
  if (v.pricePercentage != null && !/^-?\d+(\.\d+)?$/.test(v.pricePercentage)) out.push(`${where}: % of price must be a number.`);
  if (v.carrierRate != null && !ctx.carriers.has(v.carrierRate)) out.push(`${where}: carrier rate "${v.carrierRate}" isn't defined in this rate group.`);
  if (v.subtable != null) {
    if (!ctx.inTable) out.push(`${where}: a subtable can only be used inside a table.`);
    else if (!ctx.subtables.has(v.subtable)) out.push(`${where}: subtable "${v.subtable}" doesn't exist.`);
  }
}

function checkHeaders(h: Headers | undefined, where: string, ctx: { currency?: string; regions: Set<string> }, out: string[]) {
  if (!h) return;
  const kinds = headerKinds(h);
  if (kinds.length !== 1) return out.push(`${where}: headers must be of exactly one kind.`);
  if (headerSize(h) === 0) out.push(`${where}: add at least one header.`);
  for (const p of h.prices ?? []) if (ctx.currency && p.currencyCode !== ctx.currency) out.push(`${where}: price headers must be in ${ctx.currency}.`);
  for (const l of h.locations ?? []) for (const id of l.locationIds ?? []) if (!/^\d+$/.test(id)) out.push(`${where}: location "${id}" must be a numeric Google location ID.`);
  for (const g of h.postalCodeGroupNames ?? []) if (g !== "all other locations" && !ctx.regions.has(g)) out.push(`${where}: region "${g}" doesn't exist.`);
}

function checkTable(t: Table | undefined, where: string, ctx: { currency?: string; carriers: Set<string>; subtables: Set<string>; regions: Set<string> }, out: string[]) {
  if (!t) return out.push(`${where}: missing table.`);
  if (!t.rowHeaders) out.push(`${where}: add row headers.`);
  checkHeaders(t.rowHeaders, `${where} rows`, ctx, out);
  checkHeaders(t.columnHeaders, `${where} columns`, ctx, out);
  const rows = headerSize(t.rowHeaders);
  const cols = t.columnHeaders ? headerSize(t.columnHeaders) : 1;
  if ((t.rows ?? []).length !== rows) out.push(`${where}: needs ${rows} row(s), has ${(t.rows ?? []).length}.`);
  (t.rows ?? []).forEach((r, i) => {
    if ((r.cells ?? []).length !== cols) out.push(`${where} row ${i + 1}: needs ${cols} cell(s).`);
    (r.cells ?? []).forEach((c, j) => checkValue(c, `${where} row ${i + 1}, cell ${j + 1}`, { ...ctx, inTable: true }, out));
  });
}

const minMax = (min: number | undefined, max: number | undefined, label: string, where: string, out: string[]) => {
  if (min != null && max != null && min > max) out.push(`${where}: minimum ${label} days can't be more than the maximum.`);
  if ((min != null && min < 0) || (max != null && max < 0)) out.push(`${where}: ${label} days can't be negative.`);
};

/** Problems that would make Google reject the settings, in plain words. Empty when it looks valid. */
export function checkShipping(s: ShippingSettings, regionNames: string[]): string[] {
  const out: string[] = [];
  const regions = new Set(regionNames);
  const warehouses = new Set((s.warehouses ?? []).map((w) => w.name ?? ""));
  const names = new Set<string>();
  (s.services ?? []).forEach((svc, i) => {
    const where = `Service "${svc.serviceName || `#${i + 1}`}"`;
    if (!svc.serviceName?.trim()) out.push(`Service #${i + 1}: enter a name.`);
    else if (names.has(svc.serviceName)) out.push(`${where}: service names must be unique.`);
    names.add(svc.serviceName ?? "");
    if (!svc.currencyCode || !/^[A-Z]{3}$/.test(svc.currencyCode)) out.push(`${where}: choose a 3-letter currency code.`);
    if (!svc.deliveryCountries?.length) out.push(`${where}: add at least one delivery country.`);
    for (const c of svc.deliveryCountries ?? []) if (!/^[A-Z]{2}$/.test(c)) out.push(`${where}: "${c}" isn't a 2-letter country code.`);
    const dt = svc.deliveryTime;
    if (!dt) out.push(`${where}: set the delivery time.`);
    else {
      minMax(dt.minHandlingDays, dt.maxHandlingDays, "handling", where, out);
      minMax(dt.minTransitDays, dt.maxTransitDays, "transit", where, out);
      if (dt.transitTimeTable && (dt.minTransitDays != null || dt.maxTransitDays != null)) out.push(`${where}: use either transit days or a transit-time table, not both.`);
      if (dt.cutoffTime && (dt.cutoffTime.hour == null || dt.cutoffTime.hour < 0 || dt.cutoffTime.hour > 23 || (dt.cutoffTime.minute ?? 0) < 0 || (dt.cutoffTime.minute ?? 0) > 59 || !dt.cutoffTime.timeZone)) {
        out.push(`${where}: the cutoff time needs an hour (0–23), minute (0–59) and time zone.`);
      }
      const tt = dt.transitTimeTable;
      if (tt) {
        const rows = (tt.postalCodeGroupNames?.length ?? 0) || 1;
        const cols = tt.transitTimeLabels?.length && tt.postalCodeGroupNames?.length ? tt.transitTimeLabels.length : 1;
        if ((tt.rows ?? []).length !== (tt.postalCodeGroupNames?.length ? rows : tt.transitTimeLabels?.length ?? 0)) out.push(`${where} transit-time table: the rows don't match its headers.`);
        (tt.rows ?? []).forEach((r, k) => {
          if ((r.values ?? []).length !== cols) out.push(`${where} transit-time table row ${k + 1}: needs ${cols} value(s).`);
          for (const v of r.values ?? []) minMax(v.minTransitDays, v.maxTransitDays, "transit", `${where} transit-time table row ${k + 1}`, out);
        });
        for (const g of tt.postalCodeGroupNames ?? []) if (g !== "all other locations" && !regions.has(g)) out.push(`${where} transit-time table: region "${g}" doesn't exist.`);
      }
      for (const w of dt.warehouseBasedDeliveryTimes ?? []) if (!warehouses.has(w.warehouse ?? "")) out.push(`${where}: warehouse "${w.warehouse}" doesn't exist.`);
    }
    if (svc.minimumOrderValue && svc.minimumOrderValueTable) out.push(`${where}: use a minimum order value or a per-store table, not both.`);
    if (svc.minimumOrderValue && svc.minimumOrderValue.currencyCode !== svc.currencyCode) out.push(`${where}: the minimum order value must be in ${svc.currencyCode}.`);
    if (svc.storeConfig && svc.shipmentType !== "LOCAL_DELIVERY") out.push(`${where}: store settings only apply to local delivery.`);
    const groups = svc.rateGroups ?? [];
    if (groups.length === 0) out.push(`${where}: add a rate group.`);
    groups.forEach((g, k) => {
      const gw = `${where}, rate group "${g.name || `#${k + 1}`}"`;
      if (!(g.applicableShippingLabels ?? []).length && k !== groups.length - 1) out.push(`${gw}: only the last rate group can apply to "everything else" (no shipping labels).`);
      const carriers = new Set((g.carrierRates ?? []).map((c) => c.name ?? ""));
      for (const c of g.carrierRates ?? []) {
        if (!c.name || !c.carrier || !c.carrierService || !c.originPostalCode) out.push(`${gw}: each carrier rate needs a name, carrier, service and origin postal code.`);
        if (c.flatAdjustment && c.flatAdjustment.currencyCode !== svc.currencyCode) out.push(`${gw}: carrier rate adjustments must be in ${svc.currencyCode}.`);
      }
      const subtables = new Set((g.subtables ?? []).map((t) => t.name ?? ""));
      const ctx = { currency: svc.currencyCode, carriers, subtables, regions };
      if (g.singleValue && g.mainTable) out.push(`${gw}: use a single rate or a table, not both.`);
      else if (g.singleValue) checkValue(g.singleValue, `${gw} rate`, { ...ctx, inTable: false }, out);
      else if (g.mainTable) checkTable(g.mainTable, `${gw} table`, ctx, out);
      else out.push(`${gw}: set a rate.`);
      if (g.subtables?.length && !g.mainTable) out.push(`${gw}: subtables need a main table.`);
      (g.subtables ?? []).forEach((t) => {
        if (!t.name) out.push(`${gw}: every subtable needs a name.`);
        checkTable(t, `${gw} subtable "${t.name}"`, ctx, out);
      });
    });
  });
  (s.warehouses ?? []).forEach((w, i) => {
    if (!w.name) out.push(`Warehouse #${i + 1}: enter a name.`);
    if (!w.shippingAddress?.regionCode || !w.shippingAddress?.postalCode) out.push(`Warehouse "${w.name ?? i + 1}": the address needs a country and postal code.`);
  });
  return out;
}

/** Problems with a return policy before it's sent. */
export function checkReturnPolicy(p: ReturnPolicy): string[] {
  const out: string[] = [];
  if (!p.countries?.length) out.push("Add at least one country.");
  for (const c of p.countries ?? []) if (!/^[A-Z]{2}$/.test(c)) out.push(`"${c}" isn't a 2-letter country code.`);
  if (!p.returnPolicyUri || !/^https?:\/\/\S+$/i.test(p.returnPolicyUri)) out.push("Enter the return policy page's full URL.");
  if (!p.policy?.type) out.push("Choose the return window.");
  if (p.policy?.type === "NUMBER_OF_DAYS_AFTER_DELIVERY" && !(Number(p.policy.days) > 0)) out.push("Enter the number of days for returns.");
  if (p.returnShippingFee?.type === "FIXED" && !p.returnShippingFee.fixedFee?.amountMicros) out.push("Enter the fixed return shipping fee.");
  if (p.restockingFee?.fixedFee && p.restockingFee.microPercent != null) out.push("A restocking fee is a fixed amount or a percentage, not both.");
  if (p.restockingFee?.microPercent != null && (p.restockingFee.microPercent < 0 || p.restockingFee.microPercent > 100_000_000)) out.push("The restocking fee percentage must be between 0 and 100.");
  for (const s of p.seasonalOverrides ?? []) {
    if (!s.label) out.push("Every seasonal override needs a label.");
    if (!s.startDate || !s.endDate) out.push(`Seasonal override "${s.label ?? ""}": set start and end dates.`);
    if ((s.returnDays == null) === (s.returnUntilDate == null)) out.push(`Seasonal override "${s.label ?? ""}": set either return days or a return-until date.`);
  }
  return out;
}

/** Region IDs used anywhere in the settings, so deleting one can warn first. */
export function regionsInUse(s: ShippingSettings): string[] {
  const used = new Set<string>();
  for (const svc of s.services ?? []) {
    for (const g of svc.deliveryTime?.transitTimeTable?.postalCodeGroupNames ?? []) used.add(g);
    for (const rg of svc.rateGroups ?? []) {
      for (const t of [rg.mainTable, ...(rg.subtables ?? [])]) {
        for (const h of [t?.rowHeaders, t?.columnHeaders]) for (const g of h?.postalCodeGroupNames ?? []) used.add(g);
      }
    }
  }
  return [...used];
}
