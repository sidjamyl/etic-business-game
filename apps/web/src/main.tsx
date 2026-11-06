import type { AppRouter } from "@etic/server/router";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createClient, createQueryClient, TRPCProvider } from "@/lib/trpc";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const queryClient = createQueryClient();
const trpcClient = createClient();
const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: { queryClient, trpc },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <RouterProvider router={router} />
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>,
);
