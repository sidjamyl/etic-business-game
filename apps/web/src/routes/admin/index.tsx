import { createFileRoute } from "@tanstack/react-router";
import { AdminGamesPage } from "@/components/lobby/admin-games";

export const Route = createFileRoute("/admin/")({
  component: AdminGamesPage,
});
