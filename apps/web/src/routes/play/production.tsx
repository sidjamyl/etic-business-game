import { createFileRoute } from "@tanstack/react-router";
import { ProductionPage } from "@/components/modules/production/page";

export const Route = createFileRoute("/play/production")({
  component: ProductionPage,
});
