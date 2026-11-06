import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { refreshSession } from "@/lib/session";
import { useTRPC } from "@/lib/trpc";

/** Signed-in first name and sign-out (story 5, N30). */
export function UserMenu() {
  const trpc = useTRPC();
  const session = useQuery(trpc.session.queryOptions());
  const router = useRouter();
  const navigate = useNavigate();
  if (!session.data) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{session.data.name}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Se déconnecter"
        onClick={async () => {
          await authClient.signOut();
          await refreshSession(router.options.context);
          await navigate({ to: "/" });
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
