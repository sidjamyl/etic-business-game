import { createFileRoute } from "@tanstack/react-router";
import { DeliveryPage } from "@/components/modules/delivery/page";

export const Route = createFileRoute("/play/livraisons")({
  component: DeliveryPage,
});
