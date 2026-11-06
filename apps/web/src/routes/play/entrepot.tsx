import { createFileRoute } from "@tanstack/react-router";
import { WarehousePage } from "@/components/modules/warehouse/page";

export const Route = createFileRoute("/play/entrepot")({
  component: WarehousePage,
});
