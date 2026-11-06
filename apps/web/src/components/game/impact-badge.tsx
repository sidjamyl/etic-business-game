import { deliveryRules, type TransportOption } from "@etic/content";
import { Leaf, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Colour of a 0–100 rating: Pousse when good, Ocre when middling, red when bad (D1). */
export function ratingTone(value: number): string {
  if (value >= 65) return "bg-success/12 text-success";
  if (value >= 40) return "bg-warning/12 text-warning";
  return "bg-destructive/10 text-destructive";
}

function Rating({ icon: Icon, value, label }: { icon: typeof Leaf; value: number; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            ratingTone(value),
          )}
        >
          <Icon className="size-3" aria-hidden />
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent>{`${label} : ${value}/100`}</TooltipContent>
    </Tooltip>
  );
}

/** A supplier's social and environmental ratings (R4, R17); never colour alone (icon + number). */
export function EthicsBadges({ social, environmental }: { social: number; environmental: number }) {
  return (
    <span className="inline-flex gap-1.5">
      <Rating icon={Users} value={social} label="Note sociale" />
      <Rating icon={Leaf} value={environmental} label="Note environnementale" />
    </span>
  );
}

/** Environmental impact of a transport option (R8: green 90, standard 50, express 10). */
export function TransportImpactBadge({ option }: { option: TransportOption }) {
  return (
    <Rating
      icon={Leaf}
      value={deliveryRules.options[option].environmental}
      label="Impact environnemental"
    />
  );
}
