import { createFileRoute } from "@tanstack/react-router";
import { NewsPage } from "@/components/modules/news/page";

export const Route = createFileRoute("/play/news")({
  component: NewsPage,
});
