// Self-check for the shipping rules: npx tsx src/lib/merchant-shipping.check.ts
import assert from "node:assert/strict";
import { checkReturnPolicy, checkShipping, describeValue, fromMicros, toMicros, type ShippingSettings } from "./merchant-shipping";

assert.equal(toMicros("12.5"), "12500000");
assert.equal(toMicros("0"), "0");
assert.equal(toMicros("-1.25"), "-1250000");
assert.equal(toMicros("1.2345678"), undefined);
assert.equal(toMicros("abc"), undefined);
assert.equal(fromMicros("12500000"), "12.5");
assert.equal(fromMicros("-1"), "");
assert.equal(describeValue({ flatRate: { amountMicros: "0", currencyCode: "USD" } }), "Free");

const ok: ShippingSettings = {
  etag: "abc",
  warehouses: [{ name: "Main", shippingAddress: { regionCode: "US", postalCode: "94043" } }],
  services: [
    {
      serviceName: "Standard",
      active: true,
      currencyCode: "USD",
      deliveryCountries: ["US"],
      deliveryTime: { minHandlingDays: 0, maxHandlingDays: 1, minTransitDays: 2, maxTransitDays: 5, cutoffTime: { hour: 16, minute: 0, timeZone: "America/New_York" } },
      rateGroups: [
        {
          name: "By price",
          applicableShippingLabels: ["bulky"],
          carrierRates: [{ name: "ups", carrier: "UPS", carrierService: "ground", originPostalCode: "94043" }],
          mainTable: {
            rowHeaders: { prices: [{ amountMicros: "50000000", currencyCode: "USD" }, { amountMicros: "-1", currencyCode: "USD" }] },
            rows: [{ cells: [{ subtable: "heavy" }] }, { cells: [{ flatRate: { amountMicros: "0", currencyCode: "USD" } }] }],
          },
          subtables: [{ name: "heavy", rowHeaders: { weights: [{ amountMicros: "-1", unit: "KILOGRAM" }] }, rows: [{ cells: [{ carrierRate: "ups" }] }] }],
        },
        { applicableShippingLabels: [], singleValue: { flatRate: { amountMicros: "4990000", currencyCode: "USD" } } },
      ],
    },
  ],
};
assert.deepEqual(checkShipping(ok, []), [], "a valid document passes");

const bad = structuredClone(ok);
const svc = bad.services![0];
svc.currencyCode = "usd";
svc.deliveryCountries = ["USA"];
svc.deliveryTime!.minTransitDays = 9;
svc.rateGroups![0].applicableShippingLabels = [];
svc.rateGroups![0].mainTable!.rows![0].cells![0] = { subtable: "missing" };
svc.rateGroups![1].singleValue = { flatRate: { amountMicros: "1", currencyCode: "EUR" }, noShipping: true };
const problems = checkShipping(bad, []).join("\n");
for (const expect of ["3-letter currency", "2-letter country", "minimum transit", "everything else", 'subtable "missing"', "exactly one of"]) {
  assert.ok(problems.includes(expect), `expected a problem mentioning "${expect}", got:\n${problems}`);
}
assert.ok(checkShipping({ services: [{ ...ok.services![0], rateGroups: [{ mainTable: { rowHeaders: { postalCodeGroupNames: ["zone 1"] }, rows: [{ cells: [{ noShipping: true }] }] } }] }] }, []).some((p) => p.includes('region "zone 1"')));
assert.deepEqual(checkShipping({ services: [{ ...ok.services![0], rateGroups: [{ mainTable: { rowHeaders: { postalCodeGroupNames: ["zone 1"] }, rows: [{ cells: [{ noShipping: true }] }] } }] }] }, ["zone 1"]), []);

assert.deepEqual(checkReturnPolicy({ countries: ["US"], returnPolicyUri: "https://shop.example/returns", policy: { type: "NUMBER_OF_DAYS_AFTER_DELIVERY", days: "30" } }), []);
assert.ok(checkReturnPolicy({ countries: ["us"], policy: { type: "NUMBER_OF_DAYS_AFTER_DELIVERY" }, restockingFee: { fixedFee: { amountMicros: "1" }, microPercent: 5 } }).length >= 4);

console.log("merchant-shipping: all checks passed");
