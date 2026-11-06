import type { RegionId } from "@etic/content";
import { Ban, TrendingDown, TrendingUp } from "lucide-react";
import { relativeDay } from "@/components/modules/warehouse/warehouse-math";
import { dayLabel, formatNumber, percent, regionName } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cells shared by the material and machine offer tables. */

export function SupplierCell({ name, region }: { name: string; region: RegionId }) {
  return (
    <>
      <div className="font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">{regionName(region)}</div>
    </>
  );
}

/** Price change caused by a running event (R4: prices only move with events). */
export function PriceShift({ shift }: { shift: number }) {
  if (shift === 0) return null;
  const up = shift > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div
      className={cn("inline-flex items-center gap-1 text-xs", up ? "text-warning" : "text-success")}
    >
      <Icon className="size-3" aria-hidden />
      <span className="tabular">{`${up ? "+" : "−"}${percent(Math.abs(shift))}`}</span>
      <span>· événement</span>
    </div>
  );
}

/** Delivery delay and the day the goods would arrive if ordered now. */
export function DelayCell({ days, today }: { days: number | null; today: number }) {
  if (days === null) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <div className="tabular">{days} j</div>
      <div className="tabular text-xs text-muted-foreground">arrivée jour {today + days}</div>
    </>
  );
}

/** Supplier stock; "Rupture" with an icon when empty (never colour alone). */
export function StockCell({ stock }: { stock: number }) {
  if (stock > 0) return <span className="tabular font-medium">{formatNumber(stock)}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-destructive">
      <Ban className="size-3.5" aria-hidden />
      Rupture
    </span>
  );
}

export function RestockCell({ day, today }: { day: number; today: number }) {
  return (
    <>
      <div className="tabular">{dayLabel(day)}</div>
      <div className="tabular text-xs text-muted-foreground">{relativeDay(day, today)}</div>
    </>
  );
}
