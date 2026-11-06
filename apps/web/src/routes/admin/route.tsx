import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OrganizerLayout } from "@/components/layouts";
import { requireUser } from "@/lib/session";
import { darkRoute } from "@/lib/theme";

export const Route = createFileRoute("/admin")({
  ...darkRoute,
  beforeLoad: ({ context }) => requireUser(context, "organizer"),
  component: () => (
    <OrganizerLayout>
      <Outlet />
    </OrganizerLayout>
  ),
});
