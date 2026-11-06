import { type LedgerCategory, ledgerCategories } from "@etic/content";
import type { LedgerEntry } from "@etic/engine";
import { ReceiptText } from "lucide-react";
import { useId, useState } from "react";
import { EmptyState } from "@/components/game/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { dayLabel, formatNumber, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type Direction,
  filterLedger,
  isDirection,
  isLedgerCategory,
  ledgerCategoryCounts,
  plural,
} from "./finance-math";

const PAGE_SIZE = 20;

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "in", label: "Entrées" },
  { value: "out", label: "Sorties" },
];

/** Movements, latest first: income in Pousse with "+", expenses in red with "−" (D1). */
function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <Table>
      <TableCaption className="sr-only">
        Mouvements de trésorerie, du plus récent au plus ancien
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Jour</TableHead>
          <TableHead className="w-60">Catégorie</TableHead>
          <TableHead>Libellé</TableHead>
          <TableHead className="text-right">Montant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="tabular text-muted-foreground">{dayLabel(entry.day)}</TableCell>
            <TableCell>{ledgerCategories[entry.category]}</TableCell>
            <TableCell className="whitespace-normal">{entry.label}</TableCell>
            <TableCell
              className={cn(
                "tabular text-right font-medium",
                entry.amount > 0 ? "text-success" : "text-destructive",
              )}
            >
              {signedCredits(entry.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Every cash movement, latest first, by category and direction (N12, story 105). */
export function LedgerCard() {
  const { team } = useView();
  const ledger = team.finance.ledger;
  const [category, setCategory] = useState<LedgerCategory | "all">("all");
  const [direction, setDirection] = useState<Direction>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const ids = { category: useId(), direction: useId() };
  const rows = filterLedger(ledger, { category, direction });
  const shown = rows.slice(0, limit);
  const options = ledgerCategoryCounts(ledger);
  // Old movements leave the ledger: keep the selected category listed anyway.
  const missing: LedgerCategory | null =
    category !== "all" && !options.some((option) => option.category === category) ? category : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Grand livre
        </CardTitle>
        <CardDescription>
          Chaque entrée et sortie d'argent, la plus récente en premier. Seuls les mouvements récents
          sont conservés ici ; les totaux par catégorie couvrent toute la partie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ledger.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Aucun mouvement pour l'instant">
            Achats, ventes, salaires, emprunts : chaque mouvement d'argent apparaîtra ici.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={ids.category} className="eyebrow text-muted-foreground">
                  Catégorie
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(isLedgerCategory(value) ? value : "all");
                    setLimit(PAGE_SIZE);
                  }}
                >
                  <SelectTrigger id={ids.category} size="sm" className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.category} value={option.category}>
                        {option.label} ({formatNumber(option.count)})
                      </SelectItem>
                    ))}
                    {missing ? (
                      <SelectItem value={missing}>{ledgerCategories[missing]} (0)</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <span id={ids.direction} className="eyebrow text-muted-foreground">
                  Sens
                </span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={direction}
                  onValueChange={(value) => {
                    if (!isDirection(value)) return;
                    setDirection(value);
                    setLimit(PAGE_SIZE);
                  }}
                  aria-labelledby={ids.direction}
                >
                  {DIRECTIONS.map((item) => (
                    <ToggleGroupItem key={item.value} value={item.value}>
                      {item.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState icon={ReceiptText} title="Aucun mouvement pour ce filtre">
                <p>Choisissez une autre catégorie ou un autre sens.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setCategory("all");
                    setDirection("all");
                    setLimit(PAGE_SIZE);
                  }}
                >
                  Tout afficher
                </Button>
              </EmptyState>
            ) : (
              <>
                <LedgerTable entries={shown} />
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="tabular text-muted-foreground">
                    {shown.length < rows.length
                      ? `${formatNumber(shown.length)} sur ${plural(rows.length, "mouvement")}`
                      : plural(rows.length, "mouvement")}
                  </p>
                  {rows.length > limit ? (
                    <Button variant="outline" size="sm" onClick={() => setLimit(limit + PAGE_SIZE)}>
                      Afficher {formatNumber(Math.min(PAGE_SIZE, rows.length - limit))} de plus
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
