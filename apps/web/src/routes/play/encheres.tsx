import { createFileRoute } from "@tanstack/react-router";
import { AuctionsPage } from "@/components/modules/auctions/page";

export const Route = createFileRoute("/play/encheres")({
  component: AuctionsPage,
});
