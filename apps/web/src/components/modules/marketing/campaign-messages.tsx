import { Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignMessage } from "./marketing-math";

const toneStyle = {
  error: { icon: OctagonAlert, className: "text-destructive" },
  warning: { icon: TriangleAlert, className: "text-warning" },
  info: { icon: Info, className: "text-muted-foreground" },
} as const;

/**
 * What blocks a launch (errors) and what deserves attention before paying, always with an
 * icon. In the form it is a live region that stays mounted (announcements need it) and takes
 * no room when empty.
 */
export function CampaignMessages({
  messages,
  live = false,
  className,
}: {
  messages: CampaignMessage[];
  live?: boolean;
  className?: string;
}) {
  return (
    <div aria-live={live ? "polite" : undefined} className={cn("space-y-2", className)}>
      {messages.map(({ tone, text }) => {
        const { icon: Icon, className: toneClass } = toneStyle[tone];
        return (
          <p key={text} className={cn("flex items-start gap-2 text-sm text-pretty", toneClass)}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{text}</span>
          </p>
        );
      })}
    </div>
  );
}
