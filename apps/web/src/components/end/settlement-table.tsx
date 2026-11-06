import { CircleCheck, CircleMinus, type LucideIcon, Undo2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Outcome = "lost" | "refunded" | "spared";

/** Losses in Power red, refunds neutral, savings in Pousse: always with an icon (D1). */
const outcomeStyle: Record<Outcome, { icon: LucideIcon; className: string }> = {
  lost: { icon: CircleMinus, className: "bg-destructive/10 text-destructive" },
  refunded: { icon: Undo2, className: "bg-muted text-foreground" },
  spared: { icon: CircleCheck, className: "bg-success/12 text-success" },
};

/** How every commitment still running is settled when the game ends (R19). */
const settlement: { commitment: string; result: string; outcome: Outcome; note?: string }[] = [
  { commitment: "Livraisons clients encore en route", result: "Non payées", outcome: "lost" },
  { commitment: "Commandes fournisseurs non reçues", result: "Perdues", outcome: "lost" },
  {
    commitment: "Échanges entre entreprises en transit",
    result: "Annulés",
    outcome: "refunded",
    note: "Le paiement est rendu à l'acheteur : le vendeur n'est pas payé.",
  },
  { commitment: "Enchères non closes", result: "Offres remboursées", outcome: "refunded" },
  { commitment: "Stocks, machines, production en cours", result: "Valeur nulle", outcome: "lost" },
  {
    commitment: "Dette restante",
    result: "Déduite",
    outcome: "lost",
    note: "Trésorerie nette = trésorerie − dette.",
  },
  {
    commitment: "Salaires et intérêts depuis la dernière échéance",
    result: "Non prélevés",
    outcome: "spared",
  },
];

/** The settlement table of R19: what each commitment still running becomes at the close. */
export function SettlementTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Engagement en cours</TableHead>
          <TableHead>À la clôture</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {settlement.map(({ commitment, result, outcome, note }) => {
          const { icon: Icon, className } = outcomeStyle[outcome];
          return (
            <TableRow key={commitment} className="hover:bg-transparent">
              <TableCell className="py-2.5 whitespace-normal">
                <p>{commitment}</p>
                {note ? <p className="text-xs text-pretty text-muted-foreground">{note}</p> : null}
              </TableCell>
              <TableCell className="py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    className,
                  )}
                >
                  <Icon className="size-3 shrink-0" aria-hidden />
                  {result}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
