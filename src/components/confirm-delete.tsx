"use client";

import { Fragment, useState, type ReactElement, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type ConfirmDetail = { label: string; value: ReactNode };

/**
 * The confirmation every delete, revoke and disconnect goes through: says what
 * is affected, lists the specifics, and only acts on the destructive button.
 * `children` is the trigger's content and `triggerRender` its element, like AlertDialogTrigger.
 */
export function ConfirmDelete({
  triggerRender,
  children,
  title,
  description,
  details,
  note,
  confirmLabel = "Delete",
  onConfirm,
}: {
  triggerRender: ReactElement;
  children: ReactNode;
  title: string;
  description: string;
  /** What is about to be affected, as label/value rows */
  details?: ConfirmDetail[];
  /** What happens to everything else, e.g. "Data already synced is kept." */
  note?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  // Closed here, not by unmounting: the action may fail or leave the trigger in place
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={triggerRender}>{children}</AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {details && details.length > 0 && (
          <dl className="bg-muted/60 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg p-3 text-sm">
            {details.map((d) => (
              <Fragment key={d.label}>
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="min-w-0 text-right font-medium break-words tabular-nums">{d.value}</dd>
              </Fragment>
            ))}
          </dl>
        )}
        {note && <p className="text-muted-foreground text-sm">{note}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
