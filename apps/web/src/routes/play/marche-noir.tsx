import { createFileRoute } from "@tanstack/react-router";
import { BlackMarketPage } from "@/components/modules/black-market/page";
import { darkRoute } from "@/lib/theme";

/** The only dark player module (DESIGN.md §6): its dialogs and menus follow the theme too. */
export const Route = createFileRoute("/play/marche-noir")({
  ...darkRoute,
  component: BlackMarketPage,
});
