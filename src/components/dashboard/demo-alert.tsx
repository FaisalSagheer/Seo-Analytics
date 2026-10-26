import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DemoAlert() {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Demo project</AlertTitle>
      <AlertDescription>
        Everything here is generated sample data. Refreshing adds new demo data points; nothing calls a paid API.
      </AlertDescription>
    </Alert>
  );
}
