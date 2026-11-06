import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { RouterContext } from "@/lib/session";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <TooltipProvider delayDuration={200}>
      <Outlet />
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  ),
  notFoundComponent: () => (
    <main className="grid min-h-dvh place-items-center p-8 text-center">
      <div>
        <p className="eyebrow text-power-red">404</p>
        <h1 className="mt-2 text-3xl font-bold uppercase">Page introuvable</h1>
      </div>
    </main>
  ),
});
