import { createFileRoute } from "@tanstack/react-router";
import { TradesPage } from "@/components/modules/trades/page";

export const Route = createFileRoute("/play/echanges")({
  component: TradesPage,
});
