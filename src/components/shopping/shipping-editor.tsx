"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveShippingSettings } from "@/lib/actions/merchant";
import {
  checkShipping,
  type ShippingSettings,
  type Warehouse,
} from "@/lib/merchant-shipping";
import { useCan } from "@/components/permissions-provider";
import {
  DaysPicker,
  F,
  NumInput,
  dropAt,
  setAt,
} from "@/components/shopping/fields";
import { ServiceEditor } from "@/components/shopping/service-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function WarehouseEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Warehouse;
  onChange: (w: Warehouse) => void;
  onRemove: () => void;
}) {
  const a = value.shippingAddress ?? {};
  const setA = (patch: Partial<NonNullable<Warehouse["shippingAddress"]>>) =>
    onChange({ ...value, shippingAddress: { ...a, ...patch } });
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <F label="Warehouse name">
          <Input
            aria-label="Warehouse name"
            value={value.name ?? ""}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </F>
        <F label="Street">
          <Input
            aria-label="Street address"
            value={a.streetAddress ?? ""}
            onChange={(e) => setA({ streetAddress: e.target.value })}
          />
        </F>
        <F label="City">
          <Input
            aria-label="City"
            value={a.city ?? ""}
            onChange={(e) => setA({ city: e.target.value })}
          />
        </F>
        <F label="State / province">
          <Input
            aria-label="State or province"
            value={a.administrativeArea ?? ""}
            onChange={(e) => setA({ administrativeArea: e.target.value })}
          />
        </F>
        <F label="Postal code">
          <Input
            aria-label="Warehouse postal code"
            value={a.postalCode ?? ""}
            onChange={(e) => setA({ postalCode: e.target.value })}
          />
        </F>
        <F label="Country (2 letters)">
          <Input
            aria-label="Warehouse country"
            maxLength={2}
            value={a.regionCode ?? ""}
            onChange={(e) =>
              setA({
                regionCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
              })
            }
          />
        </F>
        <F label="Handling days">
          <Input
            aria-label="Warehouse handling days"
            inputMode="numeric"
            value={value.handlingDays ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                handlingDays: e.target.value.replace(/\D/g, "") || undefined,
              })
            }
          />
        </F>
        <F label="Cutoff hour (0–23)">
          <NumInput
            label="Warehouse cutoff hour"
            value={value.cutoffTime?.hour}
            onChange={(n) =>
              onChange({
                ...value,
                cutoffTime:
                  n == null && value.cutoffTime?.minute == null
                    ? undefined
                    : { ...value.cutoffTime, hour: n },
              })
            }
          />
        </F>
        <F label="Cutoff minute">
          <NumInput
            label="Warehouse cutoff minute"
            value={value.cutoffTime?.minute}
            onChange={(n) =>
              onChange({
                ...value,
                cutoffTime: { ...value.cutoffTime, minute: n },
              })
            }
          />
        </F>
      </div>
      <F label="Business days">
        <DaysPicker
          label="Warehouse business days"
          value={value.businessDayConfig}
          onChange={(d) => onChange({ ...value, businessDayConfig: d })}
        />
      </F>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="self-start"
        onClick={onRemove}
      >
        <Trash2Icon data-icon="inline-start" />
        Remove warehouse
      </Button>
    </div>
  );
}

/**
 * The whole shipping document, edited in the browser and saved in one go. Google replaces the
 * stored settings with what is sent, guarded by the etag from the last read.
 */
export function ShippingEditor({
  projectId,
  initial,
  regions,
}: {
  projectId: string;
  initial: ShippingSettings;
  regions: { id: string; label: string }[];
}) {
  const canEdit = useCan("shipping.edit");
  const [saved, setSaved] = useState(initial);
  const [doc, setDoc] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(doc) !== JSON.stringify(saved);
  const problems = useMemo(
    () =>
      checkShipping(
        doc,
        regions.map((r) => r.id),
      ),
    [doc, regions],
  );

  function save() {
    startTransition(async () => {
      const res = await saveShippingSettings(projectId, doc);
      if (!res.ok) return void toast.error(res.error);
      setSaved(res.data.settings);
      setDoc(res.data.settings);
      if (res.data.conflict)
        toast.warning(
          "Shipping was changed in Merchant Center while you were editing. The latest version is loaded; make your changes again.",
        );
      else toast.success("Shipping saved to Merchant Center.");
    });
  }

  const warehouses = doc.warehouses ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping</CardTitle>
        <CardDescription>
          {canEdit
            ? "Edit services, delivery times and rates, then save. Saving replaces the shipping settings in Merchant Center."
            : "Read-only: your role can't change Merchant Center settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Read-only: hide the add/remove buttons, keeping section toggles and dropdowns (which show values) */}
        <fieldset
          disabled={!canEdit || pending}
          className={cn(
            "flex flex-col gap-4",
            !canEdit &&
              "[&_button:not([aria-expanded]):not([role=combobox])]:hidden",
          )}
        >
          {(doc.services ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">
              No shipping services yet.
            </p>
          )}
          {(doc.services ?? []).map((s, i) => (
            <ServiceEditor
              key={i}
              value={s}
              regions={regions}
              warehouses={warehouses}
              onChange={(ns) =>
                setDoc({ ...doc, services: setAt(doc.services, i, ns) })
              }
              onRemove={() =>
                setDoc({ ...doc, services: dropAt(doc.services, i) })
              }
            />
          ))}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() =>
                setDoc({
                  ...doc,
                  services: [
                    ...(doc.services ?? []),
                    {
                      serviceName: "",
                      active: true,
                      shipmentType: "DELIVERY",
                      deliveryCountries: [],
                      currencyCode: doc.services?.[0]?.currencyCode ?? "",
                      deliveryTime: {
                        minHandlingDays: 0,
                        maxHandlingDays: 1,
                        minTransitDays: 1,
                        maxTransitDays: 3,
                      },
                      rateGroups: [
                        {
                          applicableShippingLabels: [],
                          singleValue: {
                            flatRate: {
                              amountMicros: "0",
                              currencyCode: doc.services?.[0]?.currencyCode,
                            },
                          },
                        },
                      ],
                    },
                  ],
                })
              }
            >
              <PlusIcon data-icon="inline-start" />
              Add shipping service
            </Button>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Warehouses</h3>
            {warehouses.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No warehouses. Add one to calculate delivery times per shipping
                origin.
              </p>
            )}
            {warehouses.map((w, i) => (
              <WarehouseEditor
                key={i}
                value={w}
                onChange={(nw) =>
                  setDoc({ ...doc, warehouses: setAt(doc.warehouses, i, nw) })
                }
                onRemove={() =>
                  setDoc({ ...doc, warehouses: dropAt(doc.warehouses, i) })
                }
              />
            ))}
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() =>
                  setDoc({
                    ...doc,
                    warehouses: [
                      ...warehouses,
                      { name: "", shippingAddress: {} },
                    ],
                  })
                }
              >
                <PlusIcon data-icon="inline-start" />
                Add warehouse
              </Button>
            )}
          </div>
        </fieldset>

        {canEdit && dirty && problems.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Fix these before saving</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {problems.length > 8 && <li>and {problems.length - 8} more</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {canEdit && (
          <div className="bg-background sticky bottom-0 mt-4 flex items-center gap-2 border-t py-3">
            <Button
              type="button"
              onClick={save}
              disabled={pending || !dirty || problems.length > 0}
            >
              {pending && <Spinner data-icon="inline-start" />}
              Save shipping
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending || !dirty}
              onClick={() => setDoc(saved)}
            >
              Discard changes
            </Button>
            {dirty && (
              <span className="text-muted-foreground text-sm">
                Unsaved changes
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
