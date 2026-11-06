import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/components/modules/team/page";

export const Route = createFileRoute("/play/equipe")({
  component: TeamPage,
});
