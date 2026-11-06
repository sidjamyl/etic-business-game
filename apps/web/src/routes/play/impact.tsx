import { createFileRoute } from "@tanstack/react-router";
import { ImpactPage } from "@/components/modules/impact/page";

export const Route = createFileRoute("/play/impact")({
  component: ImpactPage,
});
