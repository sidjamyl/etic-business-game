import { type ProductId, products, type RegionId, regionIds, regions } from "@etic/content";
import { ChartColumn } from "lucide-react";
import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, type TooltipContentProps, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/game/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dayLabel, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  type GroupedOrders,
  type Grouping,
  groupOrders,
  isProductId,
  isRegionId,
  niceCeil,
  type OrderFilter,
  type OrderSeries,
  plural,
  sellsAnywhere,
} from "./sales";

const RANGES = ["7", "30", "60"] as const;
type Range = (typeof RANGES)[number];
const isRange = (value: string): value is Range => (RANGES as readonly string[]).includes(value);

/**
 * One hue for every panel: regions and products are told apart by their panel title, not by
 * colour (the charter's chart colours are too close to stack four regions safely).
 */
const chartConfig = {
  units: { label: "Unités commandées", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Orders received over time, by region or by product (story 63): small multiples on a
 * shared scale, from the order history kept for the last 60 days.
 */
export function OrdersChart() {
  const { team, clock } = useView();
  const [range, setRange] = useState<Range>("60");
  const [grouping, setGrouping] = useState<Grouping>("region");
  const [productFilter, setProductFilter] = useState<ProductId | "all">("all");
  const [regionFilter, setRegionFilter] = useState<RegionId | "all">("all");
  const ids = { range: useId(), grouping: useId(), filter: useId() };
  const today = clock.time.day;
  const filter: OrderFilter = {
    fromDay: Math.max(1, today - Number(range) + 1),
    toDay: today,
    productId: grouping === "region" && productFilter !== "all" ? productFilter : null,
    regions: grouping === "product" && regionFilter !== "all" ? [regionFilter] : regionIds,
  };
  const grouped = groupOrders(team.stats.orderHistory, filter, grouping);
  const max = niceCeil(grouped.peak);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Commandes reçues
        </CardTitle>
        <CardDescription>
          Unités commandées chaque jour par les clients. Une commande reçue n'est une vente que si
          vous l'acceptez et la livrez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <span id={ids.range} className="eyebrow text-muted-foreground">
              Période
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={range}
              onValueChange={(value) => {
                if (isRange(value)) setRange(value);
              }}
              aria-labelledby={ids.range}
            >
              {RANGES.map((days) => (
                <ToggleGroupItem key={days} value={days}>
                  {days} jours
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-1.5">
            <span id={ids.grouping} className="eyebrow text-muted-foreground">
              Afficher
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={grouping}
              onValueChange={(value) => {
                if (value === "region" || value === "product") setGrouping(value);
              }}
              aria-labelledby={ids.grouping}
            >
              <ToggleGroupItem value="region">Par région</ToggleGroupItem>
              <ToggleGroupItem value="product">Par produit</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {grouping === "region" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={ids.filter} className="eyebrow text-muted-foreground">
                Produit
              </Label>
              <Select
                value={productFilter}
                onValueChange={(value) => setProductFilter(isProductId(value) ? value : "all")}
              >
                <SelectTrigger id={ids.filter} size="sm" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor={ids.filter} className="eyebrow text-muted-foreground">
                Région
              </Label>
              <Select
                value={regionFilter}
                onValueChange={(value) => setRegionFilter(isRegionId(value) ? value : "all")}
              >
                <SelectTrigger id={ids.filter} size="sm" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les régions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {grouped.peak === 0 ? (
          <EmptyState icon={ChartColumn} title="Aucune commande sur cette période">
            {sellsAnywhere(team.prices)
              ? "Essayez une autre période ou un autre filtre."
              : "Fixez un prix dans la grille pour recevoir vos premières commandes."}
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {grouped.series.map((series) => (
                <OrdersPanel
                  key={series.key}
                  series={series}
                  days={grouped.days}
                  max={max}
                  home={series.key === team.region}
                />
              ))}
            </div>
            <OrdersTable grouped={grouped} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** One small chart: a region or a product, on the scale shared by every panel. */
function OrdersPanel({
  series,
  days,
  max,
  home,
}: {
  series: OrderSeries;
  days: number[];
  max: number;
  home: boolean;
}) {
  const data = days.map((day, index) => ({ day, units: series.units[index] ?? 0 }));
  const first = days[0] ?? 1;
  const last = days[days.length - 1] ?? first;
  return (
    <figure className="rounded-lg border p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          {series.label}
          {home ? <span className="font-normal text-muted-foreground"> · votre région</span> : null}
        </span>
        <span className="tabular text-xs text-muted-foreground">
          {plural(series.total, "unité", "unités")}
        </span>
      </figcaption>
      <ChartContainer config={chartConfig} className="mt-2 aspect-auto h-28 w-full">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="15%"
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            ticks={first === last ? [first] : [first, last]}
            interval={0}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tickFormatter={(day) => `J${day}`}
          />
          <YAxis
            domain={[0, max]}
            ticks={[0, max]}
            width={36}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={(props) => <PanelTooltip {...props} />}
          />
          <Bar
            dataKey="units"
            fill="var(--color-units)"
            radius={[2, 2, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </figure>
  );
}

function PanelTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const units = typeof value === "number" ? value : 0;
  return (
    <div className="grid gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="tabular font-semibold">{plural(units, "unité", "unités")}</span>
      <span className="text-muted-foreground">{dayLabel(Number(label))}</span>
    </div>
  );
}

/** The same numbers as a table (tooltips never gate a value), latest day first. */
function OrdersTable({ grouped }: { grouped: GroupedOrders }) {
  const rows = grouped.days
    .map((day, index) => ({
      day,
      values: grouped.series.map((series) => series.units[index] ?? 0),
    }))
    .reverse();
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Voir les chiffres jour par jour
      </summary>
      <div className="mt-2 max-h-72 overflow-y-auto">
        <Table>
          <TableCaption className="sr-only">Unités commandées par jour</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Jour</TableHead>
              {grouped.series.map((series) => (
                <TableHead key={series.key} className="text-right">
                  {series.label}
                </TableHead>
              ))}
              {grouped.series.length > 1 ? (
                <TableHead className="text-right">Total</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.day}>
                <TableCell className="tabular">{dayLabel(row.day)}</TableCell>
                {row.values.map((units, index) => (
                  <TableCell
                    key={grouped.series[index]?.key ?? index}
                    className="tabular text-right"
                  >
                    {units > 0 ? formatNumber(units) : "—"}
                  </TableCell>
                ))}
                {grouped.series.length > 1 ? (
                  <TableCell className="tabular text-right font-medium">
                    {formatNumber(row.values.reduce((sum, units) => sum + units, 0))}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
