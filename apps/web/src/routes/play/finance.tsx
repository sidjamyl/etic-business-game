import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "@/components/modules/finance/page";

export const Route = createFileRoute("/play/finance")({
  component: FinancePage,
});
