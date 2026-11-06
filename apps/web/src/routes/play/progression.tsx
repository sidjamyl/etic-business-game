import { createFileRoute } from "@tanstack/react-router";
import { ProgressionPage } from "@/components/modules/progression/page";

export const Route = createFileRoute("/play/progression")({
  component: ProgressionPage,
});
