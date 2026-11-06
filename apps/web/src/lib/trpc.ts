import type { AppRouter } from "@etic/server/router";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

/**
 * Server data arrives through SSE streams and is pushed into the cache (S9):
 * queries never refetch on their own.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}

/** Commands are batched over HTTP; subscriptions use SSE (S2). Same origin: cookies just work. */
export function createClient() {
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({ url: "/api/trpc" }),
        false: httpBatchLink({ url: "/api/trpc" }),
      }),
    ],
  });
}
