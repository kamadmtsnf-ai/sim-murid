import { LoadingState } from "@/components/ui/content-state";

export function PanelLoading() {
  return <LoadingState skeleton={false}>Memuat layanan…</LoadingState>;
}
