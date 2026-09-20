import { POSWorkspace } from "@/components/pos/pos-workspace";
import type { POSSettings } from "@/lib/pos/build-pos-settings";

interface POSPageShellProps {
  settings: POSSettings;
}

export function POSPageShell({ settings }: POSPageShellProps) {
  return <POSWorkspace settings={settings} />;
}
