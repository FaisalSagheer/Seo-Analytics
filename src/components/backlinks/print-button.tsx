"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <PrinterIcon data-icon="inline-start" />
      Print / Save as PDF
    </Button>
  );
}
