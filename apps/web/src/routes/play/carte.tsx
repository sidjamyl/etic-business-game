import { createFileRoute } from "@tanstack/react-router";
import { CardPage } from "@/components/modules/card/page";

export const Route = createFileRoute("/play/carte")({
  component: CardPage,
});
