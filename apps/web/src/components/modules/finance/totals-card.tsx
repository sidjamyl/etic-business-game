import { ledgerCategories } from "@etic/content";
import { ChartBar } from "lucide-react";
import {
  Bar,
  BarChart,
  LabelList,
  ReferenceLine,
  type RenderableText,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/game/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { type CategoryTotal, categoryTotals, totalsDomain } from "./finance-math";

/**
 * Diverging bars around zero: money in to the right in Pousse, money out to the left in red
 * (D1). Side and signed labels carry the meaning too, never the colour alone.
 */
const chartConfig = {
  income: { label: "Entrées", color: "var(--success)" },
  expense: { label: "Sorties", color: "var(--destructive)" },
} satisfies ChartConfig;

const ROW_HEIGHT = 32;
const CHART_PADDING = 16;

/** Amount at the end of a bar, rounded: the table below gives the exact figures. */
function barLabel(value: RenderableText): RenderableText {
  return typeof value === "number" ? signedCredits(Math.round(value)) : null;
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-success" aria-hidden />
        Entrées (+)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-destructive" aria-hidden />
        Sorties (−)
      </li>
    </ul>
  );
}

function TotalsTooltip({
  active,
  label,
  rows,
}: TooltipContentProps & {
  rows: CategoryTotal[];
}) {
  if (!active) return null;
  const row = rows.find((item) => item.label === label);
  if (!row) return null;
  const incoming = row.amount > 0;
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-medium">{row.label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn("size-2.5 rounded-[2px]", incoming ? "bg-success" : "bg-destructive")}
          aria-hidden
        />
        <span className="text-muted-foreground">
          {incoming ? "Entrées nettes" : "Sorties nettes"}
        </span>
        <span className="tabular ml-auto pl-3 font-semibold">{signedCredits(row.amount)}</span>
      </span>
    </div>
  );
}

function TotalsChart({ rows }: { rows: CategoryTotal[] }) {
  const domain = totalsDomain(rows.map((row) => row.amount));
  return (
    <figure>
      <figcaption className="sr-only">
        Solde de chaque catégorie depuis le début de la partie : entrées à droite de zéro, sorties à
        gauche. Les montants exacts sont dans le tableau qui suit.
      </figcaption>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto w-full"
        style={{ height: rows.length * ROW_HEIGHT + CHART_PADDING }}
      >
        <BarChart
          data={rows}
          layout="vertical"
          stackOffset="sign"
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          barCategoryGap="20%"
        >
          <XAxis type="number" domain={domain} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={184}
            interval={0}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine x={0} stroke="var(--border)" />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={(props) => <TotalsTooltip {...props} rows={rows} />}
          />
          <Bar
            dataKey="income"
            stackId="flow"
            fill="var(--color-income)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={false}
          >
            {/* "right" is the end of the bar, whatever its direction. */}
            <LabelList
              dataKey="income"
              position="right"
              offset={8}
              fill="var(--foreground)"
              fontSize={12}
              formatter={barLabel}
            />
          </Bar>
          <Bar
            dataKey="expense"
            stackId="flow"
            fill="var(--color-expense)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="expense"
              position="right"
              offset={8}
              fill="var(--foreground)"
              fontSize={12}
              formatter={barLabel}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </figure>
  );
}

/** The same totals as a table, with cents (tooltips and bars never gate a value). */
function TotalsTable({ rows }: { rows: CategoryTotal[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Voir les montants exacts
      </summary>
      <Table className="mt-2">
        <TableCaption className="sr-only">
          Solde par catégorie depuis le début de la partie
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Solde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.category}>
              <TableCell>{row.label}</TableCell>
              <TableCell
                className={cn(
                  "tabular text-right font-medium",
                  row.amount > 0 ? "text-success" : "text-destructive",
                )}
              >
                {signedCredits(row.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/** Where the money came from and went, per category, over the whole game (N12). */
export function TotalsCard() {
  const { team } = useView();
  const rows = categoryTotals(team.finance.totals);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Totaux par catégorie
        </CardTitle>
        <CardDescription>
          Ce que chaque poste a rapporté ou coûté depuis le début de la partie. Le capital de départ
          figure dans « {ledgerCategories.other} ».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <EmptyState icon={ChartBar} title="Aucun mouvement pour l'instant" />
        ) : (
          <>
            <Legend />
            <TotalsChart rows={rows} />
            <TotalsTable rows={rows} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
