import { createFileRoute } from "@tanstack/react-router";
import { PurchasingPage } from "@/components/modules/purchasing/page";

export const Route = createFileRoute("/play/achats")({
  component: PurchasingPage,
});
