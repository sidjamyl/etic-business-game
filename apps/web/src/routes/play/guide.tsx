import { createFileRoute } from "@tanstack/react-router";
import { GuidePage } from "@/components/modules/guide/page";

export const Route = createFileRoute("/play/guide")({
  component: GuidePage,
});
