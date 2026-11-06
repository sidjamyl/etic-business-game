import { createFileRoute } from "@tanstack/react-router";
import { SalesPage } from "@/components/modules/sales/page";

export const Route = createFileRoute("/play/ventes")({
  component: SalesPage,
});
