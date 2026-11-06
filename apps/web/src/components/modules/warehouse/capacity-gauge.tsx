import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type FillLevel,
  fillLevel,
  freeUnits,
  type InboundTotals,
  inboundTotals,
  stockTotals,
  unitsLabel,
} from "./warehouse-math";

/** Status of the warehouse: icon + words, never colour alone (D1). */
const LEVELS: Record<
  FillLevel,
  { label: string; icon: typeof CircleCheck; text: string; fill: string }
> = {
  ok: { label: "Place disponible", icon: CircleCheck, text: "text-success", fill: "bg-cacao" },
  high: { label: "Presque plein", icon: TriangleAlert, text: "text-warning", fill: "bg-warning" },
  full: { label: "Plein", icon: OctagonAlert, text: "text-destructive", fill: "bg-destructive" },
};

/** Goods on their way: hatched, in the current text colour. */
const HATCH: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 6px)",
};

function gaugeNote(level: FillLevel, free: number, inbound: InboundTotals) {
  if (level === "full") {
    return {
      tone: "danger" as const,
      text: "Entrepôt plein : les livraisons et la production attendent qu'une place se libère, sans perte.",
    };
  }
  if (inbound.incoming > free) {
    return {
      tone: "warning" as const,
      text: `Les livraisons attendues (${unitsLabel(inbound.incoming)}) dépassent la place libre : certaines devront attendre à leur arrivée.`,
    };
  }
  if (level === "high") {
    return {
      tone: "warning" as const,
      text: "Bientôt plein : produisez, vendez ou agrandissez l'entrepôt avant que les livraisons ne soient bloquées.",
    };
  }
  return null;
}

function LegendItem({
  swatch,
  style,
  label,
  value,
}: {
  swatch: string;
  style?: CSSProperties;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-3 shrink-0 rounded-sm", swatch)} style={style} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{formatNumber(value)}</span>
    </li>
  );
}

/** How full the warehouse is, what fills it and what is coming (R9, stories 32–33). */
export function WarehouseGauge() {
  const view = useView();
  const { team } = view;
  const capacity = team.warehouse.capacity;
  const used = view.warehouseUsed;
  const free = freeUnits(used, capacity);
  const level = fillLevel(used, capacity);
  const stock = stockTotals(team);
  const inbound = inboundTotals(team);
  const status = LEVELS[level];
  const StatusIcon = status.icon;
  const note = gaugeNote(level, free, inbound);

  const share = (units: number) => (capacity > 0 ? (units / capacity) * 100 : 0);
  const materialsWidth = Math.min(100, share(stock.materials));
  const productsWidth = Math.min(100 - materialsWidth, share(stock.products));
  const incomingWidth = Math.min(100 - materialsWidth - productsWidth, share(inbound.incoming));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="eyebrow flex items-center gap-1.5 text-muted-foreground">
          Occupation <InfoTip term="warehouse" />
        </CardTitle>
        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", status.text)}>
          <StatusIcon className="size-4" aria-hidden />
          {status.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="tabular text-3xl font-semibold">
            {formatNumber(used)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {unitsLabel(capacity)}
            </span>
          </p>
          <p className="tabular text-sm text-muted-foreground">
            Occupé à {percent(capacity > 0 ? used / capacity : 1)} · {unitsLabel(free, "libre")}
          </p>
        </div>

        {/* Decorative: every figure of the bar is written in the legend below. */}
        <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full", status.fill)} style={{ width: `${materialsWidth}%` }} />
          <div
            className={cn("h-full opacity-50", status.fill)}
            style={{ width: `${productsWidth}%` }}
          />
          <div
            className="h-full text-muted-foreground/70"
            style={{ ...HATCH, width: `${Math.max(0, incomingWidth)}%` }}
          />
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <LegendItem swatch={status.fill} label="Matières premières" value={stock.materials} />
          <LegendItem
            swatch={cn(status.fill, "opacity-50")}
            label="Produits finis"
            value={stock.products}
          />
          <LegendItem
            swatch="text-muted-foreground/70 ring-1 ring-border"
            style={HATCH}
            label="En route"
            value={inbound.incoming}
          />
          <LegendItem swatch="bg-muted ring-1 ring-border" label="Libre" value={free} />
        </ul>

        {note ? (
          <p
            className={cn(
              "flex items-start gap-2 text-sm",
              note.tone === "danger" ? "text-destructive" : "text-warning",
            )}
          >
            {note.tone === "danger" ? (
              <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{note.text}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
