import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/modules/marketing/page";

export const Route = createFileRoute("/play/marketing")({
  component: MarketingPage,
});
